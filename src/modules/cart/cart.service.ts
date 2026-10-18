import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";

/**
 * Get Cart Items for user or guest session
 */
export const getCart = async (userId: number | null, sessionId?: string) => {
  let query = db.orm.public.CartItem;

  if (userId) {
    query = query.where({ userId });
  } else if (sessionId) {
    query = query.where({ sessionId });
  } else {
    return { items: [], subtotal: 0, totalItems: 0 };
  }

  const items = await query.orderBy((c) => c.createdAt.desc()).all();

  let subtotal = 0;
  let totalItems = 0;

  const populated = await Promise.all(
    items.map(async (item) => {
      const product = await db.orm.public.Product.where({ id: item.productId }).first();
      let variant = null;
      let unitPrice = product ? product.basePrice : 0;
      let inStock = product ? product.stock > 0 : false;
      let maxAvailableStock = product ? product.stock : 0;

      if (item.variantId) {
        variant = await db.orm.public.ProductVariant.where({ id: item.variantId }).first();
        if (variant) {
          unitPrice = variant.price;
          inStock = variant.stock > 0;
          maxAvailableStock = variant.stock;
        }
      }

      const itemTotal = unitPrice * item.quantity;
      subtotal += itemTotal;
      totalItems += item.quantity;

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        product: product
          ? {
              id: product.id,
              name: product.name,
              slug: product.slug,
              mainImage: product.mainImage,
              basePrice: product.basePrice,
              stock: product.stock,
              isPlatformOwned: product.isPlatformOwned,
            }
          : null,
        variant: variant
          ? {
              id: variant.id,
              title: variant.title,
              sku: variant.sku,
              price: variant.price,
              stock: variant.stock,
              image: variant.image,
              attributes: variant.attributes,
            }
          : null,
        unitPrice,
        itemTotal,
        inStock,
        maxAvailableStock,
      };
    })
  );

  return {
    items: populated,
    subtotal,
    totalItems,
  };
};

/**
 * Add or increment item in Cart
 */
export const addToCart = async (
  userId: number | null,
  sessionId: string | undefined,
  payload: { productId: number; variantId?: number | null; quantity: number }
) => {
  const product = await db.orm.public.Product.where({ id: payload.productId }).first();
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  let availableStock = product.stock;
  if (payload.variantId) {
    const variant = await db.orm.public.ProductVariant.where({ id: payload.variantId }).first();
    if (!variant || !variant.isActive) {
      throw new AppError("Selected product variant is invalid or inactive", 400);
    }
    availableStock = variant.stock;
  }

  if (availableStock < payload.quantity) {
    throw new AppError(`Only ${availableStock} items are available in stock`, 400);
  }

  // Check if item already in cart
  let existingItem;
  if (userId) {
    existingItem = await db.orm.public.CartItem
      .where({ userId })
      .where({ productId: payload.productId })
      .where({ variantId: payload.variantId ?? null })
      .first();
  } else if (sessionId) {
    existingItem = await db.orm.public.CartItem
      .where({ sessionId })
      .where({ productId: payload.productId })
      .where({ variantId: payload.variantId ?? null })
      .first();
  }

  if (existingItem) {
    const newQty = existingItem.quantity + payload.quantity;
    if (newQty > availableStock) {
      throw new AppError(`Cannot add more than ${availableStock} items to cart`, 400);
    }
    return await db.orm.public.CartItem.where({ id: existingItem.id }).update({
      quantity: newQty,
    });
  }

  return await db.orm.public.CartItem.create({
    userId: userId ?? null,
    sessionId: !userId ? (sessionId || `guest-${Date.now()}`) : null,
    productId: payload.productId,
    variantId: payload.variantId ?? null,
    quantity: payload.quantity,
  });
};

/**
 * Update Cart Item Quantity
 */
export const updateCartItemQuantity = async (
  itemId: number,
  userId: number | null,
  sessionId: string | undefined,
  quantity: number
) => {
  const item = await db.orm.public.CartItem.where({ id: itemId }).first();
  if (!item) {
    throw new AppError("Cart item not found", 404);
  }

  if (userId && item.userId !== userId) {
    throw new AppError("Unauthorized access to this cart item", 403);
  }

  if (quantity <= 0) {
    return await db.orm.public.CartItem.where({ id: itemId }).delete();
  }

  // Stock check
  let availableStock = 0;
  if (item.variantId) {
    const variant = await db.orm.public.ProductVariant.where({ id: item.variantId }).first();
    availableStock = variant?.stock ?? 0;
  } else {
    const product = await db.orm.public.Product.where({ id: item.productId }).first();
    availableStock = product?.stock ?? 0;
  }

  if (quantity > availableStock) {
    throw new AppError(`Only ${availableStock} items available in stock`, 400);
  }

  return await db.orm.public.CartItem.where({ id: itemId }).update({
    quantity,
  });
};

/**
 * Remove Item from Cart
 */
export const removeCartItem = async (itemId: number, userId: number | null) => {
  const item = await db.orm.public.CartItem.where({ id: itemId }).first();
  if (!item) {
    throw new AppError("Cart item not found", 404);
  }

  if (userId && item.userId !== userId) {
    throw new AppError("Unauthorized access to this cart item", 403);
  }

  return await db.orm.public.CartItem.where({ id: itemId }).delete();
};

/**
 * Clear Cart
 */
export const clearCart = async (userId: number | null, sessionId?: string) => {
  if (userId) {
    await db.orm.public.CartItem.where({ userId }).deleteAll();
  } else if (sessionId) {
    await db.orm.public.CartItem.where({ sessionId }).deleteAll();
  }
  return { message: "Cart cleared" };
};

export const CartService = {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
};
