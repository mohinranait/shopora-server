import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { slugify } from "../../utils/slugify.ts";
import type {
  ICategoryPopulated,
  ICategoryTreeNode,
  ICategoryFlatListItem,
  ICategoryDetailResponse,
  ICreateCategoryInput,
  IUpdateCategoryInput,
  ICategoryUpdateDbPayload,
} from "./category.interface.ts";

/**
 * Format a category row with its native included useMedia and image URL
 */
const formatCategory = (cat: any): ICategoryPopulated => ({
  id: cat.id,
  name: cat.name,
  slug: cat.slug,
  description: cat.description,
  imageId: cat.imageId,
  icon: cat.icon,
  parentId: cat.parentId,
  displayOrder: cat.displayOrder,
  isActive: cat.isActive,
  createdAt: cat.createdAt,
  updatedAt: cat.updatedAt,
  useMedia: cat.image ?? null,
  image: cat.image?.media?.url ?? null,
});

/**
 * Get all categories structured as a hierarchical tree using Prisma 8 native include
 */
export const getCategoryTree = async (): Promise<ICategoryTreeNode[]> => {
  const allCategories = await db.orm.public.Category
    .where({ isActive: true })
    .orderBy((c) => c.displayOrder.asc())
    .include("image", (u) => u.include("media"))
    .all();

  const categoryMap = new Map<string, ICategoryTreeNode>();
  const rootCategories: ICategoryTreeNode[] = [];

  for (const cat of allCategories as any[]) {
    categoryMap.set(cat.id, {
      ...formatCategory(cat),
      children: [],
    });
  }

  for (const cat of allCategories) {
    const node = categoryMap.get(cat.id);
    if (!node) continue;

    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId)!.children.push(node);
    } else {
      rootCategories.push(node);
    }
  }

  return rootCategories;
};

/**
 * Get all flat categories (with native included image and parent)
 */
export const getAllCategories = async (
  includeInactive = false
): Promise<ICategoryFlatListItem[]> => {
  const query = includeInactive
    ? db.orm.public.Category
    : db.orm.public.Category.where({ isActive: true });

  const categories = await query
    .orderBy((c) => c.displayOrder.asc())
    .include("image", (u) => u.include("media"))
    .include("parent")
    .all();

  return (categories as any[]).map((cat) => ({
    ...formatCategory(cat),
    parent: cat.parent
      ? { id: cat.parent.id, name: cat.parent.name, slug: cat.parent.slug }
      : null,
  }));
};

/**
 * Get category by slug with native included parent and children
 */
export const getCategoryBySlug = async (slug: string): Promise<ICategoryDetailResponse> => {
  const category: any = await db.orm.public.Category
    .where({ slug })
    .include("image", (u) => u.include("media"))
    .include("parent", (p) => p.include("image", (u) => u.include("media")))
    .include("children", (c) => c.include("image", (u) => u.include("media")))
    .first();

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  return {
    ...formatCategory(category),
    parent: category.parent ? formatCategory(category.parent) : null,
    children: (category.children || []).map(formatCategory),
  };
};

/**
 * Create a new Category
 */
export const createCategory = async (
  payload: ICreateCategoryInput
): Promise<ICategoryPopulated> => {
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

  const category = await db.orm.public.Category.create({
    name: payload.name,
    slug,
    description: payload.description ?? null,
    imageId: payload.imageId ?? payload.useMediaId ?? null,
    icon: payload.icon ?? null,
    parentId: payload.parentId ?? null,
    displayOrder: payload.displayOrder ?? 0,
    isActive: payload.isActive ?? true,
  });

  return await getCategoryBySlug(category.slug);
};

/**
 * Update an existing Category
 */
export const updateCategory = async (
  id: string,
  payload: IUpdateCategoryInput
): Promise<ICategoryPopulated> => {
  const existing = await db.orm.public.Category.where({ id }).first();
  if (!existing) {
    throw new AppError("Category not found", 404);
  }

  const updateData: ICategoryUpdateDbPayload = {};
  if (payload.name !== undefined) {
    updateData.name = payload.name;
    updateData.slug = slugify(payload.name);
  }
  if (payload.description !== undefined) updateData.description = payload.description;
  if (payload.imageId !== undefined || payload.useMediaId !== undefined) {
    updateData.imageId = payload.imageId !== undefined ? payload.imageId : payload.useMediaId;
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

  const updated = await db.orm.public.Category.where({ id }).update(updateData);
  if (!updated) {
    throw new AppError("Category not found", 404);
  }

  return await getCategoryBySlug(updated.slug);
};

/**
 * Delete a Category
 */
export const deleteCategory = async (id: string) => {
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
