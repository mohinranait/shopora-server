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
  brand?: string;
  sellerId?: number;
  isPlatformOwned?: boolean;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
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

/**
 * Get Paginated and Filtered Products List
 */
export const getAllProducts = async (filters: IProductFilterOptions) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 12));
  const offset = (page - 1) * limit;

  // Resolve category filter (id or slug)
  let categoryIdFilter: number | undefined;
  if (filters.category) {
    const catId = Number(filters.category);
    if (!Number.isNaN(catId)) {
      categoryIdFilter = catId;
    } else {
      const cat = await db.orm.public.Category.where({ slug: filters.category }).first();
      if (cat) categoryIdFilter = cat.id;
    }
  }

  // Resolve brand filter (id or slug)
  let brandIdFilter: number | undefined;
  if (filters.brand) {
    const bId = Number(filters.brand);
    if (!Number.isNaN(bId)) {
      brandIdFilter = bId;
    } else {
      const b = await db.orm.public.Brand.where({ slug: filters.brand }).first();
      if (b) brandIdFilter = b.id;
    }
  }

  // Build ORM query
  let query = db.orm.public.Product;

  // Role based filtering: By default public users only see APPROVED & PUBLISHED products
  if (!filters.isAdmin && !filters.sellerUserId) {
    query = query
      .where({ approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED })
      .where({ status: PRODUCT_STATUS.PUBLISHED });
  } else if (filters.sellerUserId) {
    // Find seller profile ID for this user
    const seller = await db.orm.public.SellerProfile.where({ userId: filters.sellerUserId }).first();
    if (seller) {
      query = query.where({ sellerId: seller.id });
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

  // Apply filters
  if (categoryIdFilter) {
    query = query.where({ categoryId: categoryIdFilter });
  }
  if (brandIdFilter) {
    query = query.where({ brandId: brandIdFilter });
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
  if (filters.inStock) {
    query = query.where((p) => p.stock.gt(0));
  }
  if (filters.minPrice !== undefined) {
    query = query.where((p) => p.basePrice.gte(filters.minPrice!));
  }
  if (filters.maxPrice !== undefined) {
    query = query.where((p) => p.basePrice.lte(filters.maxPrice!));
  }
  if (filters.search) {
    const searchPattern = `%${filters.search.toLowerCase()}%`;
    query = query.where((p) => p.name.ilike(searchPattern));
  }

  // Count total matches
  const countResult = await query.aggregate((a) => ({ total: a.count() }));
  const total = countResult.total;

  // Apply sorting
  if (filters.sortBy === "price_asc") {
    query = query.orderBy((p) => p.basePrice.asc());
  } else if (filters.sortBy === "price_desc") {
    query = query.orderBy((p) => p.basePrice.desc());
  } else if (filters.sortBy === "popular") {
    query = query.orderBy((p) => p.totalSold.desc());
  } else if (filters.sortBy === "top_rated") {
    query = query.orderBy((p) => p.ratingAverage.desc());
  } else {
    // Default newest
    query = query.orderBy((p) => p.createdAt.desc());
  }

  // Pagination
  const products = await query.limit(limit).offset(offset).all();

  // Populate category, brand, seller and media info for display
  const populatedProducts = await Promise.all(
    products.map(async (prod) => {
      const category = await db.orm.public.Category.where({ id: prod.categoryId }).first();
      const brand = prod.brandId
        ? await db.orm.public.Brand.where({ id: prod.brandId }).first()
        : null;
      const seller = prod.sellerId
        ? await db.orm.public.SellerProfile.where({ id: prod.sellerId }).first()
        : null;

      let mainImageUseMedia: any = null;
      if (prod.mainImageUseMediaId) {
        const um = await db.orm.public.UseMedia.where({ id: prod.mainImageUseMediaId }).first();
        if (um) {
          const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
          mainImageUseMedia = { ...um, media: m };
        }
      }

      return {
        ...prod,
        mainImageUseMedia,
        category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
        brand: brand ? { id: brand.id, name: brand.name, slug: brand.slug } : null,
        seller: seller
          ? {
              id: seller.id,
              storeName: seller.storeName,
              storeSlug: seller.storeSlug,
              storeLogo: seller.storeLogo,
            }
          : null,
      };
    })
  );

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
 * Get Product Details by Slug (including full images, variants, category, brand, seller)
 */
export const getProductBySlug = async (slug: string, requestingUser?: any) => {
  const product = await db.orm.public.Product.where({ slug }).first();
  if (!product) {
    throw new AppError("Product not found", 404);
  }

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

  let mainImageUseMedia: any = null;
  if (product.mainImageUseMediaId) {
    const um = await db.orm.public.UseMedia.where({ id: product.mainImageUseMediaId }).first();
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
    rawImages.map(async (img) => {
      let useMedia: any = null;
      if (img.useMediaId) {
        const um = await db.orm.public.UseMedia.where({ id: img.useMediaId }).first();
        if (um) {
          const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
          useMedia = { ...um, media: m };
        }
      }
      return {
        ...img,
        useMedia,
      };
    })
  );

  const rawVariants = await db.orm.public.ProductVariant
    .where({ productId: product.id })
    .where({ isActive: true })
    .all();

  const variants = await Promise.all(
    rawVariants.map(async (v) => {
      let useMedia: any = null;
      if (v.useMediaId) {
        const um = await db.orm.public.UseMedia.where({ id: v.useMediaId }).first();
        if (um) {
          const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
          useMedia = { ...um, media: m };
        }
      }
      return {
        ...v,
        useMedia,
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
    mainImageUseMedia,
    category,
    brand,
    seller: seller
      ? {
          id: seller.id,
          storeName: seller.storeName,
          storeSlug: seller.storeSlug,
          storeLogo: seller.storeLogo,
          phone: seller.phone,
        }
      : null,
    images,
    variants,
    reviews,
  };
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

  // Resolve main image useMedia and url
  let mainImageUrl = payload.mainImage || "";
  const mainImageUseMediaId = payload.mainImageUseMediaId ?? null;

  if (mainImageUseMediaId) {
    const useMedia = await db.orm.public.UseMedia.where({ id: mainImageUseMediaId }).first();
    if (useMedia) {
      const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
      if (media && !mainImageUrl) {
        mainImageUrl = media.url;
      }
    }
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
      mainImage: mainImageUrl,
      mainImageUseMediaId,
      tags: payload.tags || [],
      warranty: payload.warranty ?? null,
      weightKg: payload.weightKg ?? null,
      metaTitle: payload.metaTitle ?? payload.name,
      metaDescription: payload.metaDescription ?? payload.shortDescription ?? null,
      metaKeywords: payload.metaKeywords ?? null,
      isFeatured: payload.isFeatured || false,
      isTrending: payload.isTrending || false,
    });

    // 2. Insert gallery images if provided
    if (Array.isArray(payload.images) && payload.images.length > 0) {
      for (const img of payload.images) {
        let imgUrl = img.url || "";
        let altText = img.altText ?? null;
        const useMediaId = img.useMediaId ?? null;

        if (useMediaId && !imgUrl) {
          const useMedia = await db.orm.public.UseMedia.where({ id: useMediaId }).first();
          if (useMedia) {
            altText = altText || useMedia.alt || null;
            const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
            if (media) {
              imgUrl = media.url;
            }
          }
        }

        await tx.orm.public.ProductImage.create({
          productId: newProduct.id,
          url: imgUrl,
          altText,
          displayOrder: img.displayOrder || 0,
          isPrimary: img.isPrimary || false,
          useMediaId,
        });
      }
    }

    // 3. Insert product variants if variable product
    if (payload.productType === PRODUCT_TYPE.VARIABLE && Array.isArray(payload.variants)) {
      for (let i = 0; i < payload.variants.length; i++) {
        const v = payload.variants[i];
        const vSku = v.sku || `${newProduct.sku}-VAR${i + 1}`;
        let variantImage = v.image ?? null;
        const useMediaId = v.useMediaId ?? null;

        if (useMediaId && !variantImage) {
          const useMedia = await db.orm.public.UseMedia.where({ id: useMediaId }).first();
          if (useMedia) {
            const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
            if (media) {
              variantImage = media.url;
            }
          }
        }

        await tx.orm.public.ProductVariant.create({
          productId: newProduct.id,
          sku: vSku,
          title: v.title,
          price: v.price,
          comparePrice: v.comparePrice ?? null,
          costPrice: v.costPrice ?? null,
          stock: v.stock || 0,
          image: variantImage,
          useMediaId,
          attributes: v.attributes || {},
          barcode: v.barcode ?? null,
          isActive: v.isActive !== false,
        });
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
    if (payload.mainImage !== undefined) updateData.mainImage = payload.mainImage;
    if (payload.mainImageUseMediaId !== undefined) {
      updateData.mainImageUseMediaId = payload.mainImageUseMediaId;
      if (payload.mainImageUseMediaId) {
        const useMedia = await db.orm.public.UseMedia.where({ id: payload.mainImageUseMediaId }).first();
        if (useMedia) {
          const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
          if (media && !payload.mainImage) {
            updateData.mainImage = media.url;
          }
        }
      }
    }
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.tags !== undefined) updateData.tags = payload.tags;
    if (payload.warranty !== undefined) updateData.warranty = payload.warranty;
    if (payload.weightKg !== undefined) updateData.weightKg = payload.weightKg;
    if (payload.metaTitle !== undefined) updateData.metaTitle = payload.metaTitle;
    if (payload.metaDescription !== undefined) updateData.metaDescription = payload.metaDescription;
    if (payload.metaKeywords !== undefined) updateData.metaKeywords = payload.metaKeywords;
    if (payload.isFeatured !== undefined) updateData.isFeatured = payload.isFeatured;
    if (payload.isTrending !== undefined) updateData.isTrending = payload.isTrending;

    // Handle gallery images update if provided
    if (Array.isArray(payload.images)) {
      await tx.orm.public.ProductImage.where({ productId: id }).delete();
      for (const img of payload.images) {
        let imgUrl = img.url || "";
        let altText = img.altText ?? null;
        const useMediaId = img.useMediaId ?? null;

        if (useMediaId && !imgUrl) {
          const useMedia = await db.orm.public.UseMedia.where({ id: useMediaId }).first();
          if (useMedia) {
            altText = altText || useMedia.alt || null;
            const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
            if (media) imgUrl = media.url;
          }
        }

        await tx.orm.public.ProductImage.create({
          productId: id,
          url: imgUrl,
          altText,
          displayOrder: img.displayOrder || 0,
          isPrimary: img.isPrimary || false,
          useMediaId,
        });
      }
    }

    // Handle variants update if provided
    if (Array.isArray(payload.variants)) {
      // Recalculate total stock from variants
      updateData.stock = payload.variants.reduce((acc: number, v: any) => acc + (v.stock || 0), 0);
      
      // Upsert/create variants
      for (const v of payload.variants) {
        let variantImage = v.image ?? null;
        const useMediaId = v.useMediaId ?? null;

        if (useMediaId && !variantImage) {
          const useMedia = await db.orm.public.UseMedia.where({ id: useMediaId }).first();
          if (useMedia) {
            const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
            if (media) variantImage = media.url;
          }
        }

        if (v.id) {
          await tx.orm.public.ProductVariant.where({ id: v.id }).update({
            title: v.title,
            price: v.price,
            comparePrice: v.comparePrice ?? null,
            costPrice: v.costPrice ?? null,
            stock: v.stock || 0,
            image: variantImage,
            useMediaId,
            attributes: v.attributes || {},
            barcode: v.barcode ?? null,
            isActive: v.isActive !== false,
          });
        } else {
          const vSku = v.sku || `${product.sku}-VAR${Math.floor(100 + Math.random() * 900)}`;
          await tx.orm.public.ProductVariant.create({
            productId: product.id,
            sku: vSku,
            title: v.title,
            price: v.price,
            comparePrice: v.comparePrice ?? null,
            costPrice: v.costPrice ?? null,
            stock: v.stock || 0,
            image: variantImage,
            useMediaId,
            attributes: v.attributes || {},
            barcode: v.barcode ?? null,
            isActive: v.isActive !== false,
          });
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
  getProductBySlug,
  createProduct,
  updateProduct,
  reviewProductApproval,
  deleteProduct,
};
