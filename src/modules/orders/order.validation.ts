import { z } from "zod";
import { PAYMENT_METHOD, ORDER_STATUS } from "../../constants/index.ts";

/**
 * Address Schema for checkout
 */
export const checkoutAddressSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().min(10, "Phone number is required"),
  streetAddress: z.string().min(5, "Street address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default("Bangladesh"),
});

/**
 * Order Item Input
 */
export const orderItemInputSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().positive("Quantity must be at least 1"),
});

/**
 * Create Order Schema (Checkout)
 */
export const createOrderSchema = z.object({
  body: z.object({
    items: z.array(orderItemInputSchema).min(1, "Order must contain at least one item"),
    shippingAddress: checkoutAddressSchema,
    billingAddress: checkoutAddressSchema.optional(),
    paymentMethod: z.enum([
      PAYMENT_METHOD.COD,
      PAYMENT_METHOD.BKASH,
      PAYMENT_METHOD.NAGAD,
      PAYMENT_METHOD.STRIPE,
      PAYMENT_METHOD.SSLCOMMERZ,
    ]).default(PAYMENT_METHOD.COD),
    couponCode: z.string().optional(),
    notes: z.string().optional(),
    guestEmail: z.string().email().optional(),
    guestPhone: z.string().optional(),
  }),
});

/**
 * Update Order / Sub-Order Status Schema
 */
export const updateSubOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      ORDER_STATUS.CONFIRMED,
      ORDER_STATUS.PROCESSING,
      ORDER_STATUS.SHIPPED,
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.CANCELLED,
    ]),
    trackingNumber: z.string().optional(),
    courierName: z.string().optional(),
  }),
});

/**
 * Admin Update Payment Status Schema
 */
export const updatePaymentStatusSchema = z.object({
  body: z.object({
    paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]),
    transactionId: z.string().optional(),
  }),
});
