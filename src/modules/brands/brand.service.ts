import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { slugify } from "../../utils/slugify.ts";

/**
 * Helper to populate useMedia and virtual logo URL
 */
const populateBrandMedia = async (brand: any) => {
  let useMedia: any = null;
  if (brand.useMediaId) {
    const um = await db.orm.public.UseMedia.where({ id: brand.useMediaId }).first();
    if (um) {
      const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
      useMedia = { ...um, media: m };
    }
  }
  return {
    ...brand,
    useMedia,
    logo: useMedia?.media?.url ?? null,
  };
};

/**
 * Get all brands
 */
export const getAllBrands = async (includeInactive = false) => {
  let brands;
  if (includeInactive) {
    brands = await db.orm.public.Brand.orderBy((b) => b.name.asc()).all();
  } else {
    brands = await db.orm.public.Brand.where({ isActive: true }).orderBy((b) => b.name.asc()).all();
  }

  return await Promise.all(brands.map((b) => populateBrandMedia(b)));
};

/**
 * Get brand by slug
 */
export const getBrandBySlug = async (slug: string) => {
  const brand = await db.orm.public.Brand.where({ slug }).first();
  if (!brand) {
    throw new AppError("Brand not found", 404);
  }
  return await populateBrandMedia(brand);
};

/**
 * Create a new brand
 */
export const createBrand = async (payload: {
  name: string;
  useMediaId?: number | null;
  description?: string;
  website?: string;
  isActive?: boolean;
}) => {
  let slug = slugify(payload.name);
  const existing = await db.orm.public.Brand.where({ slug }).first();
  if (existing) {
    slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
  }

  const brand = await db.orm.public.Brand.create({
    name: payload.name,
    slug,
    useMediaId: payload.useMediaId ?? null,
    description: payload.description ?? null,
    website: payload.website ?? null,
    isActive: payload.isActive ?? true,
  });

  return await populateBrandMedia(brand);
};

/**
 * Update an existing brand
 */
export const updateBrand = async (
  id: number,
  payload: {
    name?: string;
    useMediaId?: number | null;
    description?: string;
    website?: string;
    isActive?: boolean;
  }
) => {
  const existing = await db.orm.public.Brand.where({ id }).first();
  if (!existing) {
    throw new AppError("Brand not found", 404);
  }

  const updateData: any = {};
  if (payload.name !== undefined) {
    updateData.name = payload.name;
    updateData.slug = slugify(payload.name);
  }
  if (payload.useMediaId !== undefined) {
    updateData.useMediaId = payload.useMediaId;
  }
  if (payload.description !== undefined) updateData.description = payload.description;
  if (payload.website !== undefined) updateData.website = payload.website;
  if (payload.isActive !== undefined) updateData.isActive = payload.isActive;

  const updated = await db.orm.public.Brand.where({ id }).update(updateData);
  return await populateBrandMedia(updated);
};

/**
 * Delete a brand
 */
export const deleteBrand = async (id: number) => {
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
