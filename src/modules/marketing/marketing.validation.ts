import { z } from "zod";

export const createCouponSchema = z.object({
  body: z.object({
    code: z.string().min(3, "Coupon code must be at least 3 characters").toUpperCase(),
    discountType: z.enum(["PERCENTAGE", "FIXED"]),
    discountValue: z.number().positive("Discount value must be greater than 0"),
    minOrderAmount: z.number().nonnegative().default(0),
    maxDiscountAmount: z.number().positive().optional(),
    usageLimit: z.number().int().positive().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isActive: z.boolean().default(true).optional(),
    sellerId: z.number().int().positive().nullable().optional(),
  }),
});

export const validateCouponSchema = z.object({
  body: z.object({
    code: z.string().min(1, "Coupon code is required"),
    orderAmount: z.number().positive("Order amount is required"),
  }),
});

export const createBannerSchema = z.object({
  body: z.object({
    title: z.string().min(2, "Title is required"),
    subtitle: z.string().optional(),
    imageId: z.number().int().positive().nullable().optional(),
    useMediaId: z.number().int().positive().nullable().optional(),
    mobileImageId: z.number().int().positive().nullable().optional(),
    mobileUseMediaId: z.number().int().positive().nullable().optional(),
    linkUrl: z.string().optional(),
    position: z.enum(["HERO_SLIDER", "PROMO_GRID", "MIDDLE_STRIP", "POPUP"]).default("HERO_SLIDER"),
    displayOrder: z.number().int().default(0).optional(),
    isActive: z.boolean().default(true).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});
