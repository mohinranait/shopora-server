import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { PRODUCT_APPROVAL_STATUS, PRODUCT_STATUS } from "../../constants/index.ts";

type CartOwner = { userId: number | null; sessionId?: string };

const ownerQuery = ({ userId, sessionId }: CartOwner) => {
  if (userId) return db.orm.public.CartItem.where({ userId });
  if (sessionId) return db.orm.public.CartItem.where({ sessionId });
  return null;
};

/**
 * Move a guest session's cart into the logged-in user's cart (merging duplicates)
 */
const mergeGuestCart = async (userId: number, sessionId: string) => {
  const guestItems = await db.orm.public.CartItem.where({ sessionId }).all();
  if (guestItems.length === 0) return;

  const userItems = await db.orm.public.CartItem.where({ userId }).all();
  const key = (i: { productId: number; variantId: number | null }) => `${i.productId}:${i.variantId ?? 0}`;
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
export const getCart = async (userId: number | null, sessionId?: string) => {
  if (userId && sessionId) {
    await mergeGuestCart(userId, sessionId);
  }

  const query = ownerQuery({ userId, sessionId });
  if (!query) {
    return { items: [], subtotal: 0, totalItems: 0 };
  }

  const items = await query.orderBy((c) => c.createdAt.desc()).all();
  if (items.length === 0) {
    return { items: [], subtotal: 0, totalItems: 0 };
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const variantIds = [...new Set(items.map((i) => i.variantId).filter((id): id is number => id != null))];

  const [products, variants] = await Promise.all([
    db.orm.public.Product.where((p) => p.id.in(productIds)).all(),
    variantIds.length ? db.orm.public.ProductVariant.where((v) => v.id.in(variantIds)).all() : [],
  ]);

  const sellerIds = [...new Set(products.map((p) => p.sellerId).filter((id): id is number => id != null))];
  const sellers = sellerIds.length
    ? await db.orm.public.SellerProfile.where((s) => s.id.in(sellerIds))
        .select("id", "storeName", "storeSlug", "logoId", "isVerified")
        .all()
    : [];

  // Batch-load UseMedia for products, variants, and sellers
  const allUseMediaIds = [
    ...new Set([
      ...products.map((p: any) => p.mainImageId ?? p.mainImageUseMediaId),
      ...variants.map((v: any) => v.imageId ?? v.useMediaId),
      ...sellers.map((s: any) => s.logoId ?? s.logoUseMediaId),
    ].filter((id): id is number => typeof id === "number"))
  ];

  const useMedias = allUseMediaIds.length > 0
    ? await db.orm.public.UseMedia.where((um) => um.id.in(allUseMediaIds)).all()
    : [];
  const allMediaIds = [...new Set(useMedias.map((um) => um.mediaId))];
  const medias = allMediaIds.length > 0
    ? await db.orm.public.Media.where((m) => m.id.in(allMediaIds)).all()
    : [];
  const mediaUrlMap = new Map(medias.map((m) => [m.id, m.url]));
  const useMediaUrlMap = new Map(useMedias.map((um) => [um.id, mediaUrlMap.get(um.mediaId) ?? ""]));

  const productMap = new Map(products.map((p) => [p.id, p]));
  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const sellerMap = new Map(
    sellers.map((s: any) => {
      const sLogoId = s.logoId ?? s.logoUseMediaId;
      return [
        s.id,
        {
          ...s,
          logoId: sLogoId ?? null,
          storeLogo: (sLogoId ? useMediaUrlMap.get(sLogoId) : null) ?? null,
        },
      ];
    })
  );

  let subtotal = 0;
  let totalItems = 0;

  const populated = items.map((item) => {
    const product = productMap.get(item.productId);
    const variant = item.variantId ? variantMap.get(item.variantId) ?? null : null;
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

    const seller = product?.sellerId ? sellerMap.get(product.sellerId) ?? null : null;
    const pMainId = (product as any)?.mainImageId ?? (product as any)?.mainImageUseMediaId;
    const vImgId = (variant as any)?.imageId ?? (variant as any)?.useMediaId;
    const mainImageUrl = pMainId ? useMediaUrlMap.get(pMainId) ?? "" : "";
    const variantImageUrl = vImgId ? useMediaUrlMap.get(vImgId) ?? null : null;

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
            mainImageId: pMainId ?? null,
            mainImageUseMediaId: pMainId ?? null,
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
            imageId: vImgId ?? null,
            useMediaId: vImgId ?? null,
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
  userId: number | null,
  sessionId: string | undefined,
  payload: { productId: number; variantId?: number | null; quantity: number }
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
const getOwnedItem = async (itemId: number, owner: CartOwner) => {
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
  itemId: number,
  userId: number | null,
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
export const removeCartItem = async (itemId: number, userId: number | null, sessionId?: string) => {
  await getOwnedItem(itemId, { userId, sessionId });
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
