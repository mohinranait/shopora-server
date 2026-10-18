import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { slugify } from "../../utils/slugify.ts";

/**
 * Get all categories structured as a hierarchical tree
 */
export const getCategoryTree = async () => {
  const allCategories = await db.orm.public.Category
    .where({ isActive: true })
    .orderBy((c) => c.displayOrder.asc())
    .all();

  // Populate useMedia for each category
  const populated = await Promise.all(
    allCategories.map(async (cat) => {
      let useMedia: any = null;
      if (cat.useMediaId) {
        const um = await db.orm.public.UseMedia.where({ id: cat.useMediaId }).first();
        if (um) {
          const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
          useMedia = { ...um, media: m };
        }
      }
      return { ...cat, useMedia, children: [] };
    })
  );

  // Build tree
  const categoryMap = new Map<number, any>();
  const rootCategories: any[] = [];

  for (const cat of populated) {
    categoryMap.set(cat.id, cat);
  }

  for (const cat of populated) {
    const node = categoryMap.get(cat.id);
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId).children.push(node);
    } else {
      rootCategories.push(node);
    }
  }

  return rootCategories;
};

/**
 * Get all flat categories (e.g. for dropdowns and admin tables)
 */
export const getAllCategories = async (includeInactive = false) => {
  let categories;
  if (includeInactive) {
    categories = await db.orm.public.Category
      .orderBy((c) => c.displayOrder.asc())
      .all();
  } else {
    categories = await db.orm.public.Category
      .where({ isActive: true })
      .orderBy((c) => c.displayOrder.asc())
      .all();
  }

  return await Promise.all(
    categories.map(async (cat) => {
      let useMedia: any = null;
      if (cat.useMediaId) {
        const um = await db.orm.public.UseMedia.where({ id: cat.useMediaId }).first();
        if (um) {
          const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
          useMedia = { ...um, media: m };
        }
      }
      return { ...cat, useMedia };
    })
  );
};

/**
 * Get category by slug with parent and children
 */
export const getCategoryBySlug = async (slug: string) => {
  const category = await db.orm.public.Category.where({ slug }).first();
  if (!category) {
    throw new AppError("Category not found", 404);
  }

  let useMedia: any = null;
  if (category.useMediaId) {
    const um = await db.orm.public.UseMedia.where({ id: category.useMediaId }).first();
    if (um) {
      const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
      useMedia = { ...um, media: m };
    }
  }

  const rawChildren = await db.orm.public.Category.where({ parentId: category.id }).all();
  const children = await Promise.all(
    rawChildren.map(async (child) => {
      let childMedia: any = null;
      if (child.useMediaId) {
        const um = await db.orm.public.UseMedia.where({ id: child.useMediaId }).first();
        if (um) {
          const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
          childMedia = { ...um, media: m };
        }
      }
      return { ...child, useMedia: childMedia };
    })
  );

  let parent = null;
  if (category.parentId) {
    parent = await db.orm.public.Category.where({ id: category.parentId }).first();
  }

  return {
    ...category,
    useMedia,
    parent,
    children,
  };
};

/**
 * Create a new Category
 */
export const createCategory = async (payload: {
  name: string;
  description?: string;
  image?: string;
  useMediaId?: number | null;
  icon?: string;
  parentId?: number | null;
  displayOrder?: number;
  isActive?: boolean;
}) => {
  let slug = slugify(payload.name);
  const existing = await db.orm.public.Category.where({ slug }).first();
  if (existing) {
    slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
  }

  if (payload.parentId) {
    const parent = await db.orm.public.Category.where({ id: payload.parentId }).first();
    if (!parent) {
      throw new AppError("Specified parent category does not exist", 400);
    }
  }

  let image = payload.image ?? null;
  const useMediaId = payload.useMediaId ?? null;
  if (useMediaId && !image) {
    const useMedia = await db.orm.public.UseMedia.where({ id: useMediaId }).first();
    if (useMedia) {
      const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
      if (media) image = media.url;
    }
  }

  return await db.orm.public.Category.create({
    name: payload.name,
    slug,
    description: payload.description ?? null,
    image,
    useMediaId,
    icon: payload.icon ?? null,
    parentId: payload.parentId ?? null,
    displayOrder: payload.displayOrder ?? 0,
    isActive: payload.isActive ?? true,
  });
};

/**
 * Update an existing Category
 */
export const updateCategory = async (
  id: number,
  payload: {
    name?: string;
    description?: string;
    image?: string;
    useMediaId?: number | null;
    icon?: string;
    parentId?: number | null;
    displayOrder?: number;
    isActive?: boolean;
  }
) => {
  const existing = await db.orm.public.Category.where({ id }).first();
  if (!existing) {
    throw new AppError("Category not found", 404);
  }

  const updateData: any = {};
  if (payload.name !== undefined) {
    updateData.name = payload.name;
    updateData.slug = slugify(payload.name);
  }
  if (payload.description !== undefined) updateData.description = payload.description;
  if (payload.image !== undefined) updateData.image = payload.image;
  if (payload.useMediaId !== undefined) {
    updateData.useMediaId = payload.useMediaId;
    if (payload.useMediaId && !payload.image) {
      const useMedia = await db.orm.public.UseMedia.where({ id: payload.useMediaId }).first();
      if (useMedia) {
        const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
        if (media) updateData.image = media.url;
      }
    }
  }
  if (payload.icon !== undefined) updateData.icon = payload.icon;
  if (payload.displayOrder !== undefined) updateData.displayOrder = payload.displayOrder;
  if (payload.isActive !== undefined) updateData.isActive = payload.isActive;
  if (payload.parentId !== undefined) {
    if (payload.parentId === id) {
      throw new AppError("A category cannot be its own parent", 400);
    }
    updateData.parentId = payload.parentId;
  }

  return await db.orm.public.Category.where({ id }).update(updateData);
};

/**
 * Delete a Category
 */
export const deleteCategory = async (id: number) => {
  const existing = await db.orm.public.Category.where({ id }).first();
  if (!existing) {
    throw new AppError("Category not found", 404);
  }

  // Check if category has associated products
  const productCount = await db.orm.public.Product
    .where({ categoryId: id })
    .aggregate((a) => ({ count: a.count() }));

  if (productCount.count > 0) {
    throw new AppError(
      `Cannot delete category: it is assigned to ${productCount.count} products. Please reassign products first.`,
      400
    );
  }

  return await db.orm.public.Category.where({ id }).delete();
};

export const CategoryService = {
  getCategoryTree,
  getAllCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
};
