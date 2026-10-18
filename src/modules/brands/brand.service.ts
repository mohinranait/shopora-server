import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { slugify } from "../../utils/slugify.ts";

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

  return await Promise.all(
    brands.map(async (b) => {
      let useMedia: any = null;
      if (b.useMediaId) {
        const um = await db.orm.public.UseMedia.where({ id: b.useMediaId }).first();
        if (um) {
          const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
          useMedia = { ...um, media: m };
        }
      }
      return { ...b, useMedia };
    })
  );
};

/**
 * Get brand by slug
 */
export const getBrandBySlug = async (slug: string) => {
  const brand = await db.orm.public.Brand.where({ slug }).first();
  if (!brand) {
    throw new AppError("Brand not found", 404);
  }
  let useMedia: any = null;
  if (brand.useMediaId) {
    const um = await db.orm.public.UseMedia.where({ id: brand.useMediaId }).first();
    if (um) {
      const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
      useMedia = { ...um, media: m };
    }
  }
  return { ...brand, useMedia };
};

/**
 * Create a new brand
 */
export const createBrand = async (payload: {
  name: string;
  logo?: string;
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

  let logo = payload.logo ?? null;
  const useMediaId = payload.useMediaId ?? null;
  if (useMediaId && !logo) {
    const useMedia = await db.orm.public.UseMedia.where({ id: useMediaId }).first();
    if (useMedia) {
      const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
      if (media) logo = media.url;
    }
  }

  return await db.orm.public.Brand.create({
    name: payload.name,
    slug,
    logo,
    useMediaId,
    description: payload.description ?? null,
    website: payload.website ?? null,
    isActive: payload.isActive ?? true,
  });
};

/**
 * Update an existing brand
 */
export const updateBrand = async (
  id: number,
  payload: {
    name?: string;
    logo?: string;
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
  if (payload.logo !== undefined) updateData.logo = payload.logo;
  if (payload.useMediaId !== undefined) {
    updateData.useMediaId = payload.useMediaId;
    if (payload.useMediaId && !payload.logo) {
      const useMedia = await db.orm.public.UseMedia.where({ id: payload.useMediaId }).first();
      if (useMedia) {
        const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
        if (media) updateData.logo = media.url;
      }
    }
  }
  if (payload.description !== undefined) updateData.description = payload.description;
  if (payload.website !== undefined) updateData.website = payload.website;
  if (payload.isActive !== undefined) updateData.isActive = payload.isActive;

  return await db.orm.public.Brand.where({ id }).update(updateData);
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
