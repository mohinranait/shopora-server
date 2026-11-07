import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { slugify } from "../../utils/slugify.ts";
import type {
  IBrandPopulated,
  ICreateBrandInput,
  IUpdateBrandInput,
  IBrandUpdateDbPayload,
  IBrandFilterOptions,
} from "./brand.interface.ts";

/**
 * Get all brands using Prisma 8 native relational include with server-side pagination & filtering
 */
export const getAllBrands = async (
  options: IBrandFilterOptions | boolean = false
): Promise<{ brands: any[]; meta: { page: number; limit: number; total: number; totalPages: number } }> => {
  const opts: IBrandFilterOptions =
    typeof options === "boolean" ? { includeInactive: options } : options || {};

  let query = db.orm.public.Brand;

  if (opts.status === "active") {
    query = query.where({ isActive: true });
  } else if (opts.status === "inactive") {
    query = query.where({ isActive: false });
  } else if (!opts.includeInactive && opts.status !== "all") {
    query = query.where({ isActive: true });
  }

  if (opts.search?.trim()) {
    const pattern = `%${opts.search.trim()}%`;
    query = query.where((b, { fns }) =>
      fns.or(b.name.ilike(pattern), b.slug.ilike(pattern))
    );
  }

  const countResult = await query.aggregate((a) => ({ total: a.count() }));
  const total = Number(countResult.total) || 0;

  let sortedQuery = query.orderBy((b) => b.name.asc());

  if (opts.limit !== undefined) {
    const page = opts.page ? Math.max(1, Number(opts.page)) : 1;
    const limit = Math.max(1, Number(opts.limit));
    const offset = (page - 1) * limit;

    sortedQuery = sortedQuery.limit(limit).offset(offset);

    const brands = await sortedQuery.include("logo", (u) => u.include("media")).all();
    return {
      brands,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  const brands = await sortedQuery.include("logo", (u) => u.include("media")).all();
  return {
    brands,
    meta: {
      page: 1,
      limit: total,
      total,
      totalPages: 1,
    },
  };
};

/**
 * Get brand by slug using Prisma 8 native relational include
 */
export const getBrandBySlug = async (slug: string): Promise<any> => {
  const brand = await db.orm.public.Brand
    .where({ slug })
    .include("logo", (u) => u.include("media"))
    .first();

  if (!brand) {
    throw new AppError("Brand not found", 404);
  }
  return brand;
};

/**
 * Create a new brand
 */
export const createBrand = async (payload: ICreateBrandInput): Promise<IBrandPopulated> => {
  let slug = slugify(payload.name);
  const existing = await db.orm.public.Brand.where({ slug }).first();
  if (existing) {
    slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
  }

  const brand = await db.orm.public.Brand.create({
    name: payload.name,
    slug,
    logoId: payload.logoId ?? payload.useMediaId ?? null,
    description: payload.description ?? null,
    website: payload.website ?? null,
    isActive: payload.isActive ?? true,
  });

  return await getBrandBySlug(brand.slug);
};

/**
 * Update an existing brand
 */
export const updateBrand = async (
  id: string,
  payload: IUpdateBrandInput
): Promise<IBrandPopulated> => {
  const existing = await db.orm.public.Brand.where({ id }).first();
  if (!existing) {
    throw new AppError("Brand not found", 404);
  }

  const updateData: IBrandUpdateDbPayload = {};
  if (payload.name !== undefined) {
    updateData.name = payload.name;
    updateData.slug = slugify(payload.name);
  }
  if (payload.logoId !== undefined || payload.useMediaId !== undefined) {
    updateData.logoId = payload.logoId !== undefined ? payload.logoId : payload.useMediaId;
  }
  if (payload.description !== undefined) updateData.description = payload.description;
  if (payload.website !== undefined) updateData.website = payload.website;
  if (payload.isActive !== undefined) updateData.isActive = payload.isActive;

  const updated = await db.orm.public.Brand.where({ id }).update(updateData);
  if (!updated) {
    throw new AppError("Brand not found", 404);
  }

  return await getBrandBySlug(updated.slug);
};

/**
 * Delete a brand
 */
export const deleteBrand = async (id: string) => {
  const existing = await db.orm.public.Brand.where({ id }).first();
  if (!existing) {
    throw new AppError("Brand not found", 404);
  }

  // Check if any products use this brand
  const productCount = await db.orm.public.Product
    .where({ brandId: id })
    .aggregate((a) => ({ count: a.count() }));

  if (productCount.count > 0) {
    throw new AppError(
      `Cannot delete brand: it is linked to ${productCount.count} products.`,
      400
    );
  }

  return await db.orm.public.Brand.where({ id }).delete();
};

export const BrandService = {
  getAllBrands,
  getBrandBySlug,
  createBrand,
  updateBrand,
  deleteBrand,
};
