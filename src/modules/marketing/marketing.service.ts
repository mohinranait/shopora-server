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
 * Helper: Populate banner media
 */
const populateBannerMedia = async (b: any) => {
  let useMedia: any = null;
  const targetImageId = b.imageId ?? b.useMediaId;
  if (targetImageId) {
    const um = await db.orm.public.UseMedia.where({ id: targetImageId }).first();
    if (um) {
      const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
      useMedia = { ...um, media: m };
    }
  }

  let mobileUseMedia: any = null;
  const targetMobileImageId = b.mobileImageId ?? b.mobileUseMediaId;
  if (targetMobileImageId) {
    const mum = await db.orm.public.UseMedia.where({ id: targetMobileImageId }).first();
    if (mum) {
      const mm = await db.orm.public.Media.where({ id: mum.mediaId }).first();
      mobileUseMedia = { ...mum, media: mm };
    }
  }

  return {
    ...b,
    imageId: b.imageId ?? targetImageId ?? null,
    mobileImageId: b.mobileImageId ?? targetMobileImageId ?? null,
    useMedia,
    mobileUseMedia,
    imageUrl: useMedia?.media?.url ?? null,
    mobileImageUrl: mobileUseMedia?.media?.url ?? null,
  };
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
  return await Promise.all(banners.map((b) => populateBannerMedia(b)));
};

/**
 * Admin: Create banner
 */
export const createBanner = async (payload: any) => {
  const banner = await db.orm.public.Banner.create({
    title: payload.title,
    subtitle: payload.subtitle ?? null,
    imageId: payload.imageId ?? payload.useMediaId ?? null,
    mobileImageId: payload.mobileImageId ?? payload.mobileUseMediaId ?? null,
    linkUrl: payload.linkUrl ?? null,
    position: payload.position || "HERO_SLIDER",
    displayOrder: payload.displayOrder || 0,
    isActive: payload.isActive !== false,
    startDate: payload.startDate ?? null,
    endDate: payload.endDate ?? null,
  });

  return await populateBannerMedia(banner);
};

/**
 * Admin: List all banners
 */
export const getAllBanners = async () => {
  const banners = await db.orm.public.Banner.orderBy((b) => b.displayOrder.asc()).all();
  return await Promise.all(banners.map((b) => populateBannerMedia(b)));
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
