import { z } from "zod";
import { zMoney } from "../../utils/moneySchema.ts";

export const createCouponSchema = z.object({
  body: z.object({
    code: z.string().min(3, "Coupon code must be at least 3 characters").toUpperCase(),
    discountType: z.enum(["PERCENTAGE", "FIXED"]),
    discountValue: zMoney().positive("Discount value must be greater than 0"),
    minOrderAmount: zMoney().nonnegative().default(0),
    maxDiscountAmount: zMoney().positive().optional(),
    usageLimit: z.number().int().positive().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isActive: z.boolean().default(true).optional(),
    sellerId: z.string().nullable().optional(),
  }).refine((b) => b.discountType !== "PERCENTAGE" || b.discountValue <= 100, {
    message: "A percentage discount cannot exceed 100",
    path: ["discountValue"],
  }),
});

export const validateCouponSchema = z.object({
  body: z.object({
    code: z.string().min(1, "Coupon code is required"),
    orderAmount: zMoney().positive("Order amount is required"),
  }),
});

export const createBannerSchema = z.object({
  body: z.object({
    title: z.string().min(2, "Title is required"),
    subtitle: z.string().optional(),
    imageId: z.string().nullable().optional(),
    useMediaId: z.string().nullable().optional(),
    mobileImageId: z.string().nullable().optional(),
    mobileUseMediaId: z.string().nullable().optional(),
    linkUrl: z.string().optional(),
    position: z.enum(["HERO_SLIDER", "PROMO_GRID", "MIDDLE_STRIP", "POPUP"]).default("HERO_SLIDER"),
    displayOrder: z.number().int().default(0).optional(),
    isActive: z.boolean().default(true).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});
