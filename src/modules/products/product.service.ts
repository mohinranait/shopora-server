import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { slugify, generateSKU } from "../../utils/slugify.ts";
import {
  PRODUCT_APPROVAL_STATUS,
  PRODUCT_STATUS,
  PRODUCT_TYPE,
  USER_ROLES,
  SELLER_STATUS,
} from "../../constants/index.ts";

/**
 * Filter options interface for querying products
 */
export interface IProductFilterOptions {
  search?: string;
  category?: string;
  brand?: string; // single or comma-separated brand slugs / ids
  sellerId?: number;
  isPlatformOwned?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  isFreeShipping?: boolean;
  isFeatured?: boolean;
  isTrending?: boolean;
  sortBy?: "newest" | "price_asc" | "price_desc" | "popular" | "top_rated";
  page?: number;
  limit?: number;
  approvalStatus?: string;
  status?: string;
  sellerUserId?: number; // When seller requests their own products
  isAdmin?: boolean;
}

type FacetKey = "category" | "brand" | "price";

interface IResolvedFilters {
  categoryIds?: number[]; // selected category + all of its descendants
  brandIds?: number[];
  sellerProfileId?: number;
  unresolved: boolean; // a category/brand was requested but doesn't exist -> no results
}

const splitList = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * Resolve slug/id based filters (category, brand, seller) into numeric ids in parallel
 */
const resolveFilters = async (filters: IProductFilterOptions): Promise<IResolvedFilters> => {
  const resolved: IResolvedFilters = { unresolved: false };

  const categoryTask = (async () => {
    if (!filters.category) return;
    const categories = await db.orm.public.Category.select("id", "slug", "parentId").all();
    const asId = Number(filters.category);
    const root = categories.find((c) =>
      Number.isNaN(asId) ? c.slug === filters.category : c.id === asId
    );
    if (!root) {
      resolved.unresolved = true;
      return;
    }
    const childrenOf = new Map<number, number[]>();
    for (const c of categories) {
      if (c.parentId == null) continue;
      childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c.id]);
    }
    const ids: number[] = [];
    const stack = [root.id];
    while (stack.length) {
      const id = stack.pop()!;
      ids.push(id);
      stack.push(...(childrenOf.get(id) ?? []));
    }
    resolved.categoryIds = ids;
  })();

  const brandTask = (async () => {
    const values = splitList(filters.brand);
    if (values.length === 0) return;
    const ids = values.map(Number).filter((n) => !Number.isNaN(n));
    const slugs = values.filter((v) => Number.isNaN(Number(v)));
    if (slugs.length > 0) {
      const brands = await db.orm.public.Brand.where((b) => b.slug.in(slugs)).select("id").all();
      ids.push(...brands.map((b) => b.id));
    }
    if (ids.length === 0) resolved.unresolved = true;
    else resolved.brandIds = ids;
  })();

  const sellerTask = (async () => {
    if (!filters.sellerUserId) return;
    const seller = await db.orm.public.SellerProfile.where({ userId: filters.sellerUserId }).first();
    if (seller) resolved.sellerProfileId = seller.id;
  })();

  await Promise.all([categoryTask, brandTask, sellerTask]);
  return resolved;
};

/**
 * Build the filtered product query. `omit` skips one filter group, which is
 * used for facet counts (e.g. brand counts ignore the currently selected brand).
 */
const buildProductQuery = (
  filters: IProductFilterOptions,
  resolved: IResolvedFilters,
  omit?: FacetKey
) => {
  let query = db.orm.public.Product;

  // Role based filtering: By default public users only see APPROVED & PUBLISHED products
  if (!filters.isAdmin && !filters.sellerUserId) {
    query = query
      .where({ approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED })
      .where({ status: PRODUCT_STATUS.PUBLISHED });
  } else if (filters.sellerUserId) {
    if (resolved.sellerProfileId) {
      query = query.where({ sellerId: resolved.sellerProfileId });
    }
    if (filters.approvalStatus) {
      query = query.where({ approvalStatus: filters.approvalStatus });
    }
  } else if (filters.isAdmin) {
    if (filters.approvalStatus) {
      query = query.where({ approvalStatus: filters.approvalStatus });
    }
    if (filters.status) {
      query = query.where({ status: filters.status });
    }
  }

  if (omit !== "category" && resolved.categoryIds) {
    const ids = resolved.categoryIds;
    query = query.where((p) => p.categoryId.in(ids));
  }
  if (omit !== "brand" && resolved.brandIds) {
    const ids = resolved.brandIds;
    query = query.where((p) => p.brandId.in(ids));
  }
  if (filters.sellerId !== undefined) {
    query = query.where({ sellerId: filters.sellerId });
  }
  if (filters.isPlatformOwned !== undefined) {
    query = query.where({ isPlatformOwned: filters.isPlatformOwned });
  }
  if (filters.isFeatured !== undefined) {
    query = query.where({ isFeatured: filters.isFeatured });
  }
  if (filters.isTrending !== undefined) {
    query = query.where({ isTrending: filters.isTrending });
  }
  if (filters.isFreeShipping) {
    query = query.where({ isFreeShipping: true });
  }
  if (filters.inStock) {
    query = query.where((p) => p.stock.gt(0));
  }
  if (filters.minRating !== undefined) {
    query = query.where((p) => p.ratingAverage.gte(filters.minRating!));
  }
  if (omit !== "price" && filters.minPrice !== undefined) {
    query = query.where((p) => p.basePrice.gte(filters.minPrice!));
  }
  if (omit !== "price" && filters.maxPrice !== undefined) {
    query = query.where((p) => p.basePrice.lte(filters.maxPrice!));
  }
  if (filters.search?.trim()) {
    const pattern = `%${filters.search.trim()}%`;
    query = query.where((p, { fns }) =>
      fns.or(p.name.ilike(pattern), p.sku.ilike(pattern), p.shortDescription.ilike(pattern))
    );
  }

  return query;
};

/**
 * Get Paginated and Filtered Products List
 */
export const getAllProducts = async (filters: IProductFilterOptions) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 12));
  const offset = (page - 1) * limit;
  const isPublic = !filters.isAdmin && !filters.sellerUserId;

  const resolved = await resolveFilters(filters);

  if (resolved.unresolved) {
    return { products: [], meta: { page, limit, total: 0, totalPages: 0 } };
  }

  const query = buildProductQuery(filters, resolved);

  let sorted;
  if (filters.sortBy === "price_asc") {
    sorted = query.orderBy([(p) => p.basePrice.asc(), (p) => p.id.desc()]);
  } else if (filters.sortBy === "price_desc") {
    sorted = query.orderBy([(p) => p.basePrice.desc(), (p) => p.id.desc()]);
  } else if (filters.sortBy === "popular") {
    sorted = query.orderBy([(p) => p.totalSold.desc(), (p) => p.id.desc()]);
  } else if (filters.sortBy === "top_rated") {
    sorted = query.orderBy([(p) => p.ratingAverage.desc(), (p) => p.ratingCount.desc(), (p) => p.id.desc()]);
  } else {
    sorted = query.orderBy([(p) => p.createdAt.desc(), (p) => p.id.desc()]);
  }

  // Count and page fetch run in parallel
  const [countResult, products] = await Promise.all([
    query.aggregate((a) => ({ total: a.count() })),
    sorted.limit(limit).offset(offset).all(),
  ]);
  const total = Number(countResult.total) || 0;

  // Batch-load relations (one query per relation instead of per product)
  const uniq = (ids: (number | null | undefined)[]) =>
    [...new Set(ids.filter((id): id is number => typeof id === "number"))];
  const categoryIds = uniq(products.map((p) => p.categoryId));
  const brandIds = uniq(products.map((p) => p.brandId));
  const sellerIds = uniq(products.map((p) => p.sellerId));
  const useMediaIds = uniq(products.map((p: any) => p.mainImageId ?? p.mainImageUseMediaId));

  const [categories, brands, sellers, useMedias] = await Promise.all([
    categoryIds.length
      ? db.orm.public.Category.where((c) => c.id.in(categoryIds)).select("id", "name", "slug").all()
      : [],
    brandIds.length
      ? db.orm.public.Brand.where((b) => b.id.in(brandIds)).select("id", "name", "slug").all()
      : [],
    sellerIds.length
      ? db.orm.public.SellerProfile.where((s) => s.id.in(sellerIds))
          .select("id", "storeName", "storeSlug", "logoId")
          .all()
      : [],
    useMediaIds.length ? db.orm.public.UseMedia.where((u) => u.id.in(useMediaIds)).all() : [],
  ]);

  const mediaIds = uniq(useMedias.map((u) => u.mediaId));
  const medias = mediaIds.length
    ? await db.orm.public.Media.where((m) => m.id.in(mediaIds)).all()
    : [];

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const brandMap = new Map(brands.map((b) => [b.id, b]));
  const sellerMap = new Map(sellers.map((s) => [s.id, s]));
  const mediaMap = new Map(medias.map((m) => [m.id, m]));
  const useMediaMap = new Map(
    useMedias.map((u) => [u.id, { ...u, media: mediaMap.get(u.mediaId) ?? null }])
  );

  const populatedProducts = products.map((prod: any) => {
    // Public listings don't need the long description or internal cost price
    const { description, costPrice, ...rest } = prod;
    const base = isPublic ? rest : prod;
    const targetMainId = prod.mainImageId ?? prod.mainImageUseMediaId;
    const mainMedia = targetMainId
      ? useMediaMap.get(targetMainId) ?? null
      : null;
    return {
      ...base,
      mainImageId: prod.mainImageId ?? targetMainId ?? null,
      mainImageUseMedia: mainMedia,
      mainImage: mainMedia?.media?.url ?? "",
      category: categoryMap.get(prod.categoryId) ?? null,
      brand: prod.brandId ? brandMap.get(prod.brandId) ?? null : null,
      seller: prod.sellerId ? sellerMap.get(prod.sellerId) ?? null : null,
    };
  });

  return {
    products: populatedProducts,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Filter facets for the storefront products page: categories and brands with
 * live product counts, plus the price range for the current filter set.
 */
export const getProductFilters = async (filters: IProductFilterOptions) => {
  const publicFilters = { ...filters, isAdmin: false, sellerUserId: undefined };
  const resolved = await resolveFilters(publicFilters);

  const [categoryGroups, brandGroups, priceRange, allCategories, allBrands] = await Promise.all([
    buildProductQuery(publicFilters, resolved, "category")
      .groupBy("categoryId")
      .aggregate((a) => ({ count: a.count() })),
    buildProductQuery(publicFilters, resolved, "brand")
      .groupBy("brandId")
      .aggregate((a) => ({ count: a.count() })),
    buildProductQuery(publicFilters, resolved, "price").aggregate((a) => ({
      min: a.min("basePrice"),
      max: a.max("basePrice"),
    })),
    db.orm.public.Category.where({ isActive: true })
      .orderBy((c) => c.displayOrder.asc())
      .select("id", "name", "slug", "parentId")
      .all(),
    db.orm.public.Brand.where({ isActive: true }).select("id", "name", "slug", "logoId").all(),
  ]);

  // Category tree with counts rolled up into parents
  const directCount = new Map(categoryGroups.map((g) => [g.categoryId, Number(g.count) || 0]));
  type CategoryNode = { id: number; name: string; slug: string; parentId: number | null; count: number; children: CategoryNode[] };
  const nodes = new Map<number, CategoryNode>(
    allCategories.map((c) => [
      c.id,
      { id: c.id, name: c.name, slug: c.slug, parentId: c.parentId ?? null, count: 0, children: [] },
    ])
  );
  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId != null ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const rollUp = (node: CategoryNode): number => {
    node.count = (directCount.get(node.id) ?? 0) + node.children.reduce((sum, c) => sum + rollUp(c), 0);
    return node.count;
  };
  roots.forEach(rollUp);

  const brandCount = new Map(brandGroups.map((g) => [g.brandId, Number(g.count) || 0]));
  const brands = allBrands
    .map((b) => ({ ...b, count: brandCount.get(b.id) ?? 0 }))
    .filter((b) => b.count > 0 || resolved.brandIds?.includes(b.id))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    categories: roots,
    brands,
    price: {
      min: priceRange.min == null ? 0 : Math.floor(Number(priceRange.min)),
      max: priceRange.max == null ? 0 : Math.ceil(Number(priceRange.max)),
    },
  };
};

/**
 * Helper: Populate full product relations (category, brand, seller, media, images, attributes, variants, reviews)
 */
export const populateProductDetails = async (product: any, requestingUser?: any) => {
  // If product is not approved or not published, allow only its seller or admin to view
  const isOwner =
    requestingUser &&
    requestingUser.role === USER_ROLES.SELLER &&
    requestingUser.sellerId === product.sellerId;
  const isAdmin = requestingUser && requestingUser.role === USER_ROLES.ADMIN;

  if (
    !isAdmin &&
    !isOwner &&
    (product.approvalStatus !== PRODUCT_APPROVAL_STATUS.APPROVED ||
      product.status !== PRODUCT_STATUS.PUBLISHED)
  ) {
    throw new AppError("This product is currently unavailable", 404);
  }

  // Load relations
  const category = await db.orm.public.Category.where({ id: product.categoryId }).first();
  const brand = product.brandId
    ? await db.orm.public.Brand.where({ id: product.brandId }).first()
    : null;
  const seller = product.sellerId
    ? await db.orm.public.SellerProfile.where({ id: product.sellerId }).first()
    : null;
  let sellerLogo: string | null = null;
  const sellerLogoId = (seller as any)?.logoId ?? (seller as any)?.logoUseMediaId;
  if (sellerLogoId) {
    const um = await db.orm.public.UseMedia.where({ id: sellerLogoId }).first();
    if (um) {
      const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
      sellerLogo = m?.url ?? null;
    }
  }

  let mainImageUseMedia: any = null;
  const productMainId = product.mainImageId ?? product.mainImageUseMediaId;
  if (productMainId) {
    const um = await db.orm.public.UseMedia.where({ id: productMainId }).first();
    if (um) {
      const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
      mainImageUseMedia = { ...um, media: m };
    }
  }

  const rawImages = await db.orm.public.ProductImage
    .where({ productId: product.id })
    .orderBy((img) => img.displayOrder.asc())
    .all();

  const images = await Promise.all(
    rawImages.map(async (img: any) => {
      let useMedia: any = null;
      const imgTargetId = img.imageId ?? img.useMediaId;
      if (imgTargetId) {
        const um = await db.orm.public.UseMedia.where({ id: imgTargetId }).first();
        if (um) {
          const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
          useMedia = { ...um, media: m };
        }
      }
      return {
        ...img,
        imageId: img.imageId ?? imgTargetId ?? null,
        useMedia,
        url: useMedia?.media?.url ?? "",
      };
    })
  );

  // Load selectedAttributes (both simple specification attributes and variation attributes)
  const rawProductAttributes = await db.orm.public.ProductAttribute
    .where({ productId: product.id })
    .all();

  const selectedAttributes = await Promise.all(
    rawProductAttributes.map(async (pa) => {
      const attribute = await db.orm.public.Attribute.where({ id: pa.attributeId }).first();
      const rawPav = await db.orm.public.ProductAttributeValue
        .where({ productAttributeId: pa.id })
        .all();

      const values = await Promise.all(
        rawPav.map(async (pav) => {
          if (pav.attributeValueId) {
            const av = await db.orm.public.AttributeValue.where({ id: pav.attributeValueId }).first();
            return {
              id: pav.id,
              attributeValueId: av?.id || pav.attributeValueId,
              value: av?.value || "",
              colorCode: av?.colorCode || null,
              displayOrder: av?.displayOrder || 0,
            };
          }
          return {
            id: pav.id,
            attributeValueId: null,
            value: pav.customValue || "",
            customValue: pav.customValue,
            colorCode: null,
            displayOrder: 0,
          };
        })
      );

      return {
        id: pa.id,
        attributeId: pa.attributeId,
        name: attribute?.name || "",
        slug: attribute?.slug || "",
        type: attribute?.type || "SELECT",
        description: attribute?.description || null,
        isVariation: pa.isVariation,
        values,
      };
    })
  );

  const rawVariants = await db.orm.public.ProductVariant
    .where({ productId: product.id })
    .all();

  const variants = await Promise.all(
    rawVariants.map(async (v: any) => {
      let useMedia: any = null;
      const vTargetId = v.imageId ?? v.useMediaId;
      if (vTargetId) {
        const um = await db.orm.public.UseMedia.where({ id: vTargetId }).first();
        if (um) {
          const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
          useMedia = { ...um, media: m };
        }
      }

      // Load relational variant attribute values
      const rawVav = await db.orm.public.ProductVariantAttributeValue
        .where({ variantId: v.id })
        .all();

      const attributeValues = await Promise.all(
        rawVav.map(async (vav) => {
          const attr = await db.orm.public.Attribute.where({ id: vav.attributeId }).first();
          const av = await db.orm.public.AttributeValue.where({ id: vav.attributeValueId }).first();
          return {
            id: vav.id,
            attributeId: vav.attributeId,
            attributeName: attr?.name || "",
            attributeSlug: attr?.slug || "",
            attributeValueId: vav.attributeValueId,
            value: av?.value || "",
            colorCode: av?.colorCode || null,
          };
        })
      );

      return {
        ...v,
        imageId: v.imageId ?? vTargetId ?? null,
        useMedia,
        image: useMedia?.media?.url ?? null,
        attributeValues,
        attributeValueIds: rawVav.map((x) => x.attributeValueId),
      };
    })
  );

  const reviews = await db.orm.public.ProductReview
    .where({ productId: product.id })
    .where({ isApproved: true })
    .orderBy((r) => r.createdAt.desc())
    .limit(10)
    .all();

  return {
    ...product,
    mainImageId: product.mainImageId ?? productMainId ?? null,
    mainImageUseMedia,
    mainImage: mainImageUseMedia?.media?.url ?? "",
    category,
    brand,
    seller: seller
      ? {
          id: seller.id,
          storeName: seller.storeName,
          storeSlug: seller.storeSlug,
          storeLogo: sellerLogo,
          phone: seller.phone,
        }
      : null,
    images,
    selectedAttributes,
    variants,
    reviews,
  };
};

/**
 * Get Product Details by Slug (including full images, variants, category, brand, seller)
 */
export const getProductBySlug = async (slug: string, requestingUser?: any) => {
  const product = await db.orm.public.Product.where({ slug }).first();
  if (!product) {
    throw new AppError("Product not found", 404);
  }
  return await populateProductDetails(product, requestingUser);
};

/**
 * Get Product Details by ID (for admin/seller editing and detail viewing)
 */
export const getProductById = async (id: number, requestingUser?: any) => {
  const product = await db.orm.public.Product.where({ id }).first();
  if (!product) {
    throw new AppError("Product not found", 404);
  }
  return await populateProductDetails(product, requestingUser);
};

/**
 * Create a new product (Platform-owned if Admin, or Vendor-owned if Seller)
 */
export const createProduct = async (
  user: { id: number; role: string; sellerId?: number | null },
  payload: any
) => {
  // Validate category
  const category = await db.orm.public.Category.where({ id: payload.categoryId }).first();
  if (!category) {
    throw new AppError("Category not found", 404);
  }

  // Validate brand if provided
  if (payload.brandId) {
    const brand = await db.orm.public.Brand.where({ id: payload.brandId }).first();
    if (!brand) {
      throw new AppError("Brand not found", 404);
    }
  }

  let isPlatformOwned = false;
  let sellerId: number | null = null;
  let approvalStatus: string = PRODUCT_APPROVAL_STATUS.PENDING;

  if (user.role === USER_ROLES.ADMIN) {
    isPlatformOwned = true;
    sellerId = null;
    approvalStatus = PRODUCT_APPROVAL_STATUS.APPROVED; // Admin products are auto-approved
  } else if (user.role === USER_ROLES.SELLER) {
    if (!user.sellerId) {
      throw new AppError("Seller profile not found. Please complete seller registration.", 403);
    }
    const seller = await db.orm.public.SellerProfile.where({ id: user.sellerId }).first();
    if (!seller || seller.status !== SELLER_STATUS.APPROVED) {
      throw new AppError("Your seller account is pending approval or suspended. You cannot upload products yet.", 403);
    }
    isPlatformOwned = false;
    sellerId = user.sellerId;
    approvalStatus = PRODUCT_APPROVAL_STATUS.PENDING; // Needs admin approval
  } else {
    throw new AppError("Unauthorized to create products", 403);
  }

  // Generate unique slug
  let slug = slugify(payload.name);
  const existing = await db.orm.public.Product.where({ slug }).first();
  if (existing) {
    slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Generate master SKU
  const productSKU = payload.sku || generateSKU(isPlatformOwned ? "SHO-ADM" : "SHO-VND");

  // Calculate total stock if variable product
  let calculatedStock = payload.stock || 0;
  if (payload.productType === PRODUCT_TYPE.VARIABLE && Array.isArray(payload.variants) && payload.variants.length > 0) {
    calculatedStock = payload.variants.reduce((acc: number, v: any) => acc + (v.stock || 0), 0);
  }

  // Transaction to create product, gallery images and variants
  return await db.transaction(async (tx) => {
    // 1. Create main product record
    const newProduct = await tx.orm.public.Product.create({
      name: payload.name,
      slug,
      sku: productSKU,
      shortDescription: payload.shortDescription ?? null,
      description: payload.description,
      categoryId: payload.categoryId,
      brandId: payload.brandId ?? null,
      sellerId,
      isPlatformOwned,
      approvalStatus,
      status: PRODUCT_STATUS.PUBLISHED,
      productType: payload.productType || PRODUCT_TYPE.SIMPLE,
      basePrice: payload.basePrice,
      comparePrice: payload.comparePrice ?? null,
      costPrice: payload.costPrice ?? null,
      stock: calculatedStock,
      lowStockThreshold: payload.lowStockThreshold || 5,
      mainImageId: payload.mainImageId ?? payload.mainImageUseMediaId ?? null,
      tags: payload.tags || [],
      warranty: payload.warranty ?? null,
      weightKg: payload.weightKg ?? null,
      dimensions: payload.dimensions ?? null,
      videoUrl: payload.videoUrl ?? null,
      trackStock: payload.trackStock !== undefined ? payload.trackStock : true,
      isFreeShipping: payload.isFreeShipping ?? false,
      metaTitle: payload.metaTitle ?? payload.name,
      metaDescription: payload.metaDescription ?? payload.shortDescription ?? null,
      metaKeywords: payload.metaKeywords ?? null,
      isFeatured: payload.isFeatured || false,
      isTrending: payload.isTrending || false,
    });

    // 2. Insert gallery images if provided
    if (Array.isArray(payload.images) && payload.images.length > 0) {
      for (const img of payload.images) {
        const targetImgId = img.imageId ?? img.useMediaId;
        if (!targetImgId) continue;
        await tx.orm.public.ProductImage.create({
          productId: newProduct.id,
          altText: img.altText ?? null,
          displayOrder: img.displayOrder || 0,
          isPrimary: img.isPrimary || false,
          imageId: targetImgId,
        });
      }
    }

    // 3. Insert Selected Product Attributes & Attribute Values (Simple Specs or Variation Attributes)
    if (Array.isArray(payload.selectedAttributes) && payload.selectedAttributes.length > 0) {
      for (const attrItem of payload.selectedAttributes) {
        const prodAttr = await tx.orm.public.ProductAttribute.create({
          productId: newProduct.id,
          attributeId: attrItem.attributeId,
          isVariation: attrItem.isVariation || false,
        });

        if (Array.isArray(attrItem.values)) {
          for (const val of attrItem.values) {
            const numVal = Number(val);
            if (!Number.isNaN(numVal) && typeof val === "number") {
              await tx.orm.public.ProductAttributeValue.create({
                productAttributeId: prodAttr.id,
                attributeValueId: numVal,
                customValue: null,
              });
            } else {
              await tx.orm.public.ProductAttributeValue.create({
                productAttributeId: prodAttr.id,
                attributeValueId: null,
                customValue: String(val),
              });
            }
          }
        }
      }
    }

    // 4. Insert product variants if variable product
    if (payload.productType === PRODUCT_TYPE.VARIABLE && Array.isArray(payload.variants)) {
      for (let i = 0; i < payload.variants.length; i++) {
        const v = payload.variants[i];
        const vSku = v.sku || `${newProduct.sku}-VAR${i + 1}`;
        const targetVarImgId = v.imageId ?? v.useMediaId ?? null;

        const variant = await tx.orm.public.ProductVariant.create({
          productId: newProduct.id,
          sku: vSku,
          title: v.title,
          price: v.price,
          comparePrice: v.comparePrice ?? null,
          costPrice: v.costPrice ?? null,
          stock: v.stock || 0,
          lowStockThreshold: v.lowStockThreshold || 5,
          imageId: targetVarImgId,
          attributes: v.attributes || {},
          barcode: v.barcode ?? null,
          weightKg: v.weightKg ?? null,
          dimensions: v.dimensions ?? null,
          isDefault: v.isDefault || false,
          isActive: v.isActive !== false,
        });

        // Insert variant attribute values in ProductVariantAttributeValue
        if (Array.isArray(v.attributeValueIds) && v.attributeValueIds.length > 0) {
          for (const attrValId of v.attributeValueIds) {
            const av = await tx.orm.public.AttributeValue.where({ id: attrValId }).first();
            if (av) {
              await tx.orm.public.ProductVariantAttributeValue.create({
                variantId: variant.id,
                attributeId: av.attributeId,
                attributeValueId: av.id,
              });
            }
          }
        }
      }
    }

    return newProduct;
  });
};

/**
 * Update an existing product
 */
export const updateProduct = async (
  id: number,
  user: { id: number; role: string; sellerId?: number | null },
  payload: any
) => {
  const product = await db.orm.public.Product.where({ id }).first();
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  // Authorization check
  if (user.role === USER_ROLES.SELLER) {
    if (product.sellerId !== user.sellerId) {
      throw new AppError("You can only edit your own products", 403);
    }
  }

  return await db.transaction(async (tx) => {
    const updateData: any = {};
    if (payload.name) {
      updateData.name = payload.name;
      updateData.slug = slugify(payload.name);
    }
    if (payload.shortDescription !== undefined) updateData.shortDescription = payload.shortDescription;
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.categoryId !== undefined) updateData.categoryId = payload.categoryId;
    if (payload.brandId !== undefined) updateData.brandId = payload.brandId;
    if (payload.basePrice !== undefined) updateData.basePrice = payload.basePrice;
    if (payload.comparePrice !== undefined) updateData.comparePrice = payload.comparePrice;
    if (payload.costPrice !== undefined) updateData.costPrice = payload.costPrice;
    if (payload.lowStockThreshold !== undefined) updateData.lowStockThreshold = payload.lowStockThreshold;
    if (payload.mainImageId !== undefined || payload.mainImageUseMediaId !== undefined) {
      updateData.mainImageId = payload.mainImageId !== undefined ? payload.mainImageId : payload.mainImageUseMediaId;
    }
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.productType !== undefined) updateData.productType = payload.productType;
    if (payload.tags !== undefined) updateData.tags = payload.tags;
    if (payload.warranty !== undefined) updateData.warranty = payload.warranty;
    if (payload.weightKg !== undefined) updateData.weightKg = payload.weightKg;
    if (payload.dimensions !== undefined) updateData.dimensions = payload.dimensions;
    if (payload.videoUrl !== undefined) updateData.videoUrl = payload.videoUrl;
    if (payload.trackStock !== undefined) updateData.trackStock = payload.trackStock;
    if (payload.isFreeShipping !== undefined) updateData.isFreeShipping = payload.isFreeShipping;
    if (payload.metaTitle !== undefined) updateData.metaTitle = payload.metaTitle;
    if (payload.metaDescription !== undefined) updateData.metaDescription = payload.metaDescription;
    if (payload.metaKeywords !== undefined) updateData.metaKeywords = payload.metaKeywords;
    if (payload.isFeatured !== undefined) updateData.isFeatured = payload.isFeatured;
    if (payload.isTrending !== undefined) updateData.isTrending = payload.isTrending;

    // Handle gallery images update if provided
    if (Array.isArray(payload.images)) {
      await tx.orm.public.ProductImage.where({ productId: id }).delete();
      for (const img of payload.images) {
        const targetImgId = img.imageId ?? img.useMediaId;
        if (!targetImgId) continue;
        await tx.orm.public.ProductImage.create({
          productId: id,
          altText: img.altText ?? null,
          displayOrder: img.displayOrder || 0,
          isPrimary: img.isPrimary || false,
          imageId: targetImgId,
        });
      }
    }

    // Handle selectedAttributes update if provided
    if (Array.isArray(payload.selectedAttributes)) {
      await tx.orm.public.ProductAttribute.where({ productId: id }).delete();
      for (const attrItem of payload.selectedAttributes) {
        const prodAttr = await tx.orm.public.ProductAttribute.create({
          productId: id,
          attributeId: attrItem.attributeId,
          isVariation: attrItem.isVariation || false,
        });

        if (Array.isArray(attrItem.values)) {
          for (const val of attrItem.values) {
            const numVal = Number(val);
            if (!Number.isNaN(numVal) && typeof val === "number") {
              await tx.orm.public.ProductAttributeValue.create({
                productAttributeId: prodAttr.id,
                attributeValueId: numVal,
                customValue: null,
              });
            } else {
              await tx.orm.public.ProductAttributeValue.create({
                productAttributeId: prodAttr.id,
                attributeValueId: null,
                customValue: String(val),
              });
            }
          }
        }
      }
    }

    // Handle variants update if provided
    if (Array.isArray(payload.variants)) {
      // Recalculate total stock from variants
      updateData.stock = payload.variants.reduce((acc: number, v: any) => acc + (v.stock || 0), 0);
      
      // Cleanup variants removed in UI
      const retainedVariantIds = payload.variants
        .map((v: any) => (v.id ? Number(v.id) : null))
        .filter((id: number | null): id is number => id !== null && !Number.isNaN(id));

      const existingVariants = await tx.orm.public.ProductVariant.where({ productId: id }).all();
      for (const exVar of existingVariants) {
        if (!retainedVariantIds.includes(exVar.id)) {
          await tx.orm.public.ProductVariantAttributeValue.where({ variantId: exVar.id }).delete();
          await tx.orm.public.ProductVariant.where({ id: exVar.id }).delete();
        }
      }

      // Upsert/create variants
      for (const v of payload.variants) {
        const imageId = v.imageId !== undefined ? v.imageId : (v.useMediaId ?? null);

        let variantId = v.id;
        if (variantId) {
          await tx.orm.public.ProductVariant.where({ id: variantId }).update({
            title: v.title,
            price: v.price,
            comparePrice: v.comparePrice ?? null,
            costPrice: v.costPrice ?? null,
            stock: v.stock || 0,
            lowStockThreshold: v.lowStockThreshold !== undefined ? v.lowStockThreshold : 5,
            imageId,
            attributes: v.attributes || {},
            barcode: v.barcode ?? null,
            weightKg: v.weightKg ?? null,
            dimensions: v.dimensions ?? null,
            isDefault: v.isDefault || false,
            isActive: v.isActive !== false,
          });
        } else {
          const vSku = v.sku || `${product.sku}-VAR${Math.floor(100 + Math.random() * 900)}`;
          const createdVariant = await tx.orm.public.ProductVariant.create({
            productId: product.id,
            sku: vSku,
            title: v.title,
            price: v.price,
            comparePrice: v.comparePrice ?? null,
            costPrice: v.costPrice ?? null,
            stock: v.stock || 0,
            lowStockThreshold: v.lowStockThreshold || 5,
            imageId,
            attributes: v.attributes || {},
            barcode: v.barcode ?? null,
            weightKg: v.weightKg ?? null,
            dimensions: v.dimensions ?? null,
            isDefault: v.isDefault || false,
            isActive: v.isActive !== false,
          });
          variantId = createdVariant.id;
        }

        // Synchronize ProductVariantAttributeValue
        if (Array.isArray(v.attributeValueIds) && variantId) {
          await tx.orm.public.ProductVariantAttributeValue.where({ variantId }).delete();
          for (const attrValId of v.attributeValueIds) {
            const av = await tx.orm.public.AttributeValue.where({ id: attrValId }).first();
            if (av) {
              await tx.orm.public.ProductVariantAttributeValue.create({
                variantId,
                attributeId: av.attributeId,
                attributeValueId: av.id,
              });
            }
          }
        }
      }
    } else if (payload.stock !== undefined) {
      updateData.stock = payload.stock;
    }

    return await tx.orm.public.Product.where({ id }).update(updateData);
  });
};

/**
 * Admin Product Approval / Rejection
 */
export const reviewProductApproval = async (
  id: number,
  payload: { status: string; rejectionReason?: string }
) => {
  const product = await db.orm.public.Product.where({ id }).first();
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const updated = await db.orm.public.Product.where({ id }).update({
    approvalStatus: payload.status,
    rejectionReason: payload.status === PRODUCT_APPROVAL_STATUS.REJECTED ? payload.rejectionReason ?? "Does not meet platform quality standards" : null,
  });

  // Create notification for seller if vendor product
  if (product.sellerId) {
    const seller = await db.orm.public.SellerProfile.where({ id: product.sellerId }).first();
    if (seller) {
      await db.orm.public.Notification.create({
        userId: seller.userId,
        title: `Product ${payload.status === PRODUCT_APPROVAL_STATUS.APPROVED ? "Approved" : "Rejected"}`,
        message:
          payload.status === PRODUCT_APPROVAL_STATUS.APPROVED
            ? `Your product "${product.name}" has been approved and is now live on Shopora!`
            : `Your product "${product.name}" was rejected. Reason: ${payload.rejectionReason || "Quality check failed"}`,
        type: "PRODUCT_APPROVAL",
        link: `/seller/products`,
      });
    }
  }

  return updated;
};

/**
 * Delete Product
 */
export const deleteProduct = async (
  id: number,
  user: { id: number; role: string; sellerId?: number | null }
) => {
  const product = await db.orm.public.Product.where({ id }).first();
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  if (user.role === USER_ROLES.SELLER && product.sellerId !== user.sellerId) {
    throw new AppError("You can only delete your own products", 403);
  }

  // Check if product was purchased in orders
  const orderItemCount = await db.orm.public.OrderItem
    .where({ productId: id })
    .aggregate((a) => ({ count: a.count() }));

  if (orderItemCount.count > 0) {
    // Soft archive rather than hard delete to preserve financial & order history
    await db.orm.public.Product.where({ id }).update({
      status: PRODUCT_STATUS.ARCHIVED,
    });
    return { message: "Product has associated orders; it has been archived rather than permanently deleted." };
  }

  await db.orm.public.Product.where({ id }).delete();
  return { message: "Product deleted permanently" };
};

export const ProductService = {
  getAllProducts,
  getProductFilters,
  getProductBySlug,
  getProductById,
  createProduct,
  updateProduct,
  reviewProductApproval,
  deleteProduct,
};
