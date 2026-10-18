import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";

/**
 * Validate and calculate coupon discount
 */
export const validateCoupon = async (code: string, orderAmount: number) => {
  const coupon = await db.orm.public.Coupon.where({
    code: code.trim().toUpperCase(),
  }).first();

  if (!coupon || !coupon.isActive) {
    throw new AppError("Invalid or inactive coupon code", 400);
  }

  // Check usage limit
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError("This coupon has reached its maximum usage limit", 400);
  }

  // Check minimum order amount
  if (orderAmount < coupon.minOrderAmount) {
    throw new AppError(`Minimum order amount of ${coupon.minOrderAmount} BDT is required for this coupon`, 400);
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    discountAmount = (orderAmount * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
      discountAmount = coupon.maxDiscountAmount;
    }
  } else {
    discountAmount = coupon.discountValue;
  }

  discountAmount = Math.min(discountAmount, orderAmount);

  return {
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discountAmount,
    finalAmount: orderAmount - discountAmount,
  };
};

/**
 * Admin: Create coupon
 */
export const createCoupon = async (payload: any) => {
  const code = payload.code.trim().toUpperCase();
  const existing = await db.orm.public.Coupon.where({ code }).first();
  if (existing) {
    throw new AppError("A coupon with this code already exists", 409);
  }

  return await db.orm.public.Coupon.create({
    code,
    discountType: payload.discountType,
    discountValue: payload.discountValue,
    minOrderAmount: payload.minOrderAmount || 0,
    maxDiscountAmount: payload.maxDiscountAmount ?? null,
    usageLimit: payload.usageLimit ?? null,
    startDate: payload.startDate ?? null,
    endDate: payload.endDate ?? null,
    isActive: payload.isActive !== false,
    sellerId: payload.sellerId ?? null,
  });
};

/**
 * Admin: List coupons
 */
export const getAllCoupons = async () => {
  return await db.orm.public.Coupon.orderBy((c) => c.createdAt.desc()).all();
};

/**
 * Admin: Delete coupon
 */
export const deleteCoupon = async (id: number) => {
  return await db.orm.public.Coupon.where({ id }).delete();
};

/**
 * Public: Get active banners by position
 */
export const getActiveBanners = async (position?: string) => {
  let query = db.orm.public.Banner.where({ isActive: true });
  if (position) {
    query = query.where({ position });
  }

  const banners = await query.orderBy((b) => b.displayOrder.asc()).all();
  return await Promise.all(
    banners.map(async (b) => {
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
 * Admin: Create banner
 */
export const createBanner = async (payload: any) => {
  let imageUrl = payload.imageUrl || "";
  const useMediaId = payload.useMediaId ?? null;

  if (useMediaId && !imageUrl) {
    const useMedia = await db.orm.public.UseMedia.where({ id: useMediaId }).first();
    if (useMedia) {
      const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
      if (media) imageUrl = media.url;
    }
  }

  return await db.orm.public.Banner.create({
    title: payload.title,
    subtitle: payload.subtitle ?? null,
    imageUrl,
    useMediaId,
    mobileImageUrl: payload.mobileImageUrl ?? null,
    linkUrl: payload.linkUrl ?? null,
    position: payload.position || "HERO_SLIDER",
    displayOrder: payload.displayOrder || 0,
    isActive: payload.isActive !== false,
    startDate: payload.startDate ?? null,
    endDate: payload.endDate ?? null,
  });
};

/**
 * Admin: List all banners
 */
export const getAllBanners = async () => {
  const banners = await db.orm.public.Banner.orderBy((b) => b.displayOrder.asc()).all();
  return await Promise.all(
    banners.map(async (b) => {
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
 * Admin: Delete banner
 */
export const deleteBanner = async (id: number) => {
  return await db.orm.public.Banner.where({ id }).delete();
};

export const MarketingService = {
  validateCoupon,
  createCoupon,
  getAllCoupons,
  deleteCoupon,
  getActiveBanners,
  createBanner,
  getAllBanners,
  deleteBanner,
};
