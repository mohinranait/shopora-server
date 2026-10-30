import { z } from "zod";
import { SELLER_STATUS } from "../../constants/index.ts";

export const updateSellerProfileSchema = z.object({
  body: z.object({
    storeName: z.string().min(3).optional(),
    logoId: z.string().nullable().optional(),
    logoUseMediaId: z.string().nullable().optional(),
    bannerId: z.string().nullable().optional(),
    bannerUseMediaId: z.string().nullable().optional(),
    storeDescription: z.string().optional(),
    phone: z.string().optional(),
    businessAddress: z.string().optional(),
    bankName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankRouting: z.string().optional(),
    bkashOrNagad: z.string().optional(),
  }),
});

export const reviewSellerApplicationSchema = z.object({
  body: z.object({
    status: z.enum([
      SELLER_STATUS.APPROVED,
      SELLER_STATUS.REJECTED,
      SELLER_STATUS.SUSPENDED,
      SELLER_STATUS.PENDING,
    ]),
    rejectionReason: z.string().optional(),
    commissionRate: z.number().min(0).max(100).optional(), // Custom commission % (e.g. 8.5%)
    isVerified: z.boolean().optional(),
  }),
});

export const sendSellerNoticeSchema = z.object({
  body: z.object({
    title: z.string().min(2, "Title is required"),
    message: z.string().min(5, "Message must be at least 5 characters"),
  }),
});
