import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { slugify } from "../../utils/slugify.ts";
import type {
  IBrandPopulated,
  ICreateBrandInput,
  IUpdateBrandInput,
  IBrandUpdateDbPayload,
} from "./brand.interface.ts";

/**
 * Format a brand with its native included logo & media relations
 */
const formatBrand = (b: any): IBrandPopulated => ({
  id: b.id,
  name: b.name,
  slug: b.slug,
  description: b.description,
  website: b.website,
  logoId: b.logoId,
  isActive: b.isActive,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
  useMedia: b.logo ?? null,
  logo: b.logo?.media?.url ?? null,
});

/**
 * Get all brands using Prisma 8 native relational include
 */
export const getAllBrands = async (includeInactive = false): Promise<IBrandPopulated[]> => {
  const query = includeInactive
    ? db.orm.public.Brand
    : db.orm.public.Brand.where({ isActive: true });

  const brands = await query
    .orderBy((b) => b.name.asc())
    .include("logo", (u) => u.include("media"))
    .all();

  return brands.map(formatBrand);
};

/**
 * Get brand by slug using Prisma 8 native relational include
 */
export const getBrandBySlug = async (slug: string): Promise<IBrandPopulated> => {
  const brand = await db.orm.public.Brand
    .where({ slug })
    .include("logo", (u) => u.include("media"))
    .first();

  if (!brand) {
    throw new AppError("Brand not found", 404);
  }
  return formatBrand(brand);
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
