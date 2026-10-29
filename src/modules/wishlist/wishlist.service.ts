import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";

/**
 * Toggle product in Wishlist (Add if not present, remove if already present)
 */
export const toggleWishlistItem = async (userId: number, productId: number) => {
  const product = await db.orm.public.Product.where({ id: productId }).first();
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const existing = await db.orm.public.WishlistItem
    .where({ userId })
    .where({ productId })
    .first();

  if (existing) {
    await db.orm.public.WishlistItem.where({ id: existing.id }).delete();
    return { isWishlisted: false, message: "Removed from wishlist" };
  }

  await db.orm.public.WishlistItem.create({
    userId,
    productId,
  });

  return { isWishlisted: true, message: "Added to wishlist" };
};

/**
 * Get all Wishlist items for a user
 */
export const getUserWishlist = async (userId: number) => {
  const items = await db.orm.public.WishlistItem
    .where({ userId })
    .orderBy((w) => w.createdAt.desc())
    .all();

  const populated = await Promise.all(
    items.map(async (item) => {
      const product = await db.orm.public.Product.where({ id: item.productId }).first();
      return {
        id: item.id,
        productId: item.productId,
        createdAt: item.createdAt,
        product: product
          ? {
              id: product.id,
              name: product.name,
              slug: product.slug,
              productType: product.productType,
              mainImage: product.mainImage,
              basePrice: product.basePrice,
              comparePrice: product.comparePrice,
              stock: product.stock,
              ratingAverage: product.ratingAverage,
              ratingCount: product.ratingCount,
              status: product.status,
            }
          : null,
      };
    })
  );

  return populated.filter((item) => item.product !== null);
};

/**
 * Remove specific item from Wishlist
 */
export const removeWishlistItem = async (userId: number, productId: number) => {
  const item = await db.orm.public.WishlistItem
    .where({ userId })
    .where({ productId })
    .first();

  if (!item) {
    throw new AppError("Product not found in your wishlist", 404);
  }

  await db.orm.public.WishlistItem.where({ id: item.id }).delete();
  return { message: "Item removed from wishlist" };
};

/**
 * Clear all items from user's Wishlist
 */
export const clearWishlist = async (userId: number) => {
  const items = await db.orm.public.WishlistItem.where({ userId }).all();
  for (const item of items) {
    await db.orm.public.WishlistItem.where({ id: item.id }).delete();
  }
  return { message: "Wishlist cleared successfully" };
};

export const WishlistService = {
  toggleWishlistItem,
  getUserWishlist,
  removeWishlistItem,
  clearWishlist,
};
