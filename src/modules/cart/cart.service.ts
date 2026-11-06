import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { PRODUCT_APPROVAL_STATUS, PRODUCT_STATUS } from "../../constants/index.ts";

type CartOwner = { userId: string | null; sessionId?: string };

const ownerQuery = ({ userId, sessionId }: CartOwner) => {
  if (userId) return db.orm.public.CartItem.where({ userId });
  if (sessionId) return db.orm.public.CartItem.where({ sessionId });
  return null;
};

/**
 * Move a guest session's cart into the logged-in user's cart (merging duplicates)
 */
const mergeGuestCart = async (userId: string, sessionId: string) => {
  const guestItems = await db.orm.public.CartItem.where({ sessionId }).all();
  if (guestItems.length === 0) return;

  const userItems = await db.orm.public.CartItem.where({ userId }).all();
  const key = (i: { productId: string; variantId: string | null }) => `${i.productId}:${i.variantId ?? 0}`;
  const userByKey = new Map(userItems.map((i) => [key(i), i]));

  for (const item of guestItems) {
    const existing = userByKey.get(key(item));
    if (existing) {
      await db.orm.public.CartItem.where({ id: existing.id }).update({
        quantity: existing.quantity + item.quantity,
      });
      await db.orm.public.CartItem.where({ id: item.id }).delete();
    } else {
      await db.orm.public.CartItem.where({ id: item.id }).update({ userId, sessionId: null });
    }
  }
};

/**
 * Get Cart Items for user or guest session (relations batch-loaded)
 */
export const getCart = async (userId: string | null, sessionId?: string) => {
  if (userId && sessionId) {
    await mergeGuestCart(userId, sessionId);
  }

  const query = ownerQuery({ userId, sessionId });
  if (!query) {
    return { items: [], subtotal: 0, totalItems: 0 };
  }

  const items: any[] = await query
    .orderBy((c) => c.createdAt.desc())
    .include("product", (p) =>
      p
        .include("mainImage", (u) => u.include("media"))
        .include("seller", (s) => s.include("logo", (u) => u.include("media")))
    )
    .include("variant", (v) => v.include("image", (u) => u.include("media")))
    .all();

  if (items.length === 0) {
    return { items: [], subtotal: 0, totalItems: 0 };
  }

  let subtotal = 0;
  let totalItems = 0;

  const populated = items.map((item) => {
    const product = item.product;
    const variant = item.variant;
    const isAvailable =
      !!product &&
      product.approvalStatus === PRODUCT_APPROVAL_STATUS.APPROVED &&
      product.status === PRODUCT_STATUS.PUBLISHED &&
      (!variant || variant.isActive);

    const unitPrice = variant ? variant.price : product?.basePrice ?? 0;
    const comparePrice = variant ? variant.comparePrice ?? null : product?.comparePrice ?? null;
    const maxAvailableStock = isAvailable ? (variant ? variant.stock : product!.stock) : 0;
    const inStock = maxAvailableStock > 0;
    const itemTotal = unitPrice * item.quantity;

    // Only purchasable lines count towards the total
    if (isAvailable && inStock) {
      subtotal += itemTotal;
      totalItems += item.quantity;
    }

    const seller = product?.seller
      ? {
          id: product.seller.id,
          storeName: product.seller.storeName,
          storeSlug: product.seller.storeSlug,
          isVerified: product.seller.isVerified,
          logoId: product.seller.logoId ?? null,
          storeLogo: product.seller.logo?.media?.url ?? null,
        }
      : null;

    const mainImageUrl = product?.mainImage?.media?.url ?? "";
    const variantImageUrl = variant?.image?.media?.url ?? null;

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
            mainImage: mainImageUrl,
            mainImageId: product.mainImageId ?? null,
            mainImageUseMediaId: product.mainImageId ?? null,
            basePrice: product.basePrice,
            stock: product.stock,
            isPlatformOwned: product.isPlatformOwned,
            isFreeShipping: product.isFreeShipping,
          }
        : null,
      variant: variant
        ? {
            id: variant.id,
            title: variant.title,
            sku: variant.sku,
            price: variant.price,
            stock: variant.stock,
            image: variantImageUrl,
            imageId: variant.imageId ?? null,
            useMediaId: variant.imageId ?? null,
            attributes: variant.attributes,
          }
        : null,
      seller,
      unitPrice,
      comparePrice,
      itemTotal,
      inStock,
      isAvailable,
      maxAvailableStock,
    };
  });

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
  userId: string | null,
  sessionId: string | undefined,
  payload: { productId: string; variantId?: string | null; quantity: number }
) => {
  const quantity = Math.max(1, Math.floor(Number(payload.quantity) || 1));
  if (!userId && !sessionId) {
    throw new AppError("A cart session is required", 400);
  }

  const product = await db.orm.public.Product.where({ id: payload.productId }).first();
  if (
    !product ||
    product.approvalStatus !== PRODUCT_APPROVAL_STATUS.APPROVED ||
    product.status !== PRODUCT_STATUS.PUBLISHED
  ) {
    throw new AppError("Product not found", 404);
  }

  let availableStock = product.stock;
  if (payload.variantId) {
    const variant = await db.orm.public.ProductVariant.where({ id: payload.variantId }).first();
    if (!variant || !variant.isActive || variant.productId !== product.id) {
      throw new AppError("Selected product variant is invalid or inactive", 400);
    }
    availableStock = variant.stock;
  }

  const existingItem = await ownerQuery({ userId, sessionId })!
    .where({ productId: payload.productId })
    .where({ variantId: payload.variantId ?? null })
    .first();

  const newQty = (existingItem?.quantity ?? 0) + quantity;
  if (newQty > availableStock) {
    throw new AppError(
      availableStock <= 0 ? "This item is out of stock" : `Only ${availableStock} items are available in stock`,
      400
    );
  }

  if (existingItem) {
    return await db.orm.public.CartItem.where({ id: existingItem.id }).update({ quantity: newQty });
  }

  return await db.orm.public.CartItem.create({
    userId: userId ?? null,
    sessionId: userId ? null : sessionId!,
    productId: payload.productId,
    variantId: payload.variantId ?? null,
    quantity,
  });
};

/**
 * Load a cart item and make sure it belongs to the requesting user or guest session
 */
const getOwnedItem = async (itemId: string, owner: CartOwner) => {
  const item = await db.orm.public.CartItem.where({ id: itemId }).first();
  if (!item) {
    throw new AppError("Cart item not found", 404);
  }
  const owns = owner.userId
    ? item.userId === owner.userId
    : !!owner.sessionId && item.sessionId === owner.sessionId;
  if (!owns) {
    throw new AppError("Cart item not found", 404);
  }
  return item;
};

/**
 * Update Cart Item Quantity
 */
export const updateCartItemQuantity = async (
  itemId: string,
  userId: string | null,
  sessionId: string | undefined,
  quantity: number
) => {
  const item = await getOwnedItem(itemId, { userId, sessionId });
  const qty = Math.floor(Number(quantity) || 0);

  if (qty <= 0) {
    return await db.orm.public.CartItem.where({ id: itemId }).delete();
  }

  let availableStock = 0;
  if (item.variantId) {
    const variant = await db.orm.public.ProductVariant.where({ id: item.variantId }).first();
    availableStock = variant?.stock ?? 0;
  } else {
    const product = await db.orm.public.Product.where({ id: item.productId }).first();
    availableStock = product?.stock ?? 0;
  }

  if (qty > availableStock) {
    throw new AppError(`Only ${availableStock} items available in stock`, 400);
  }

  return await db.orm.public.CartItem.where({ id: itemId }).update({ quantity: qty });
};

/**
 * Remove Item from Cart
 */
export const removeCartItem = async (itemId: string, userId: string | null, sessionId?: string) => {
  await getOwnedItem(itemId, { userId, sessionId });
  return await db.orm.public.CartItem.where({ id: itemId }).delete();
};

/**
 * Clear Cart
 */
export const clearCart = async (userId: string | null, sessionId?: string) => {
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
