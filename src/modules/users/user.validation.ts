import { z } from "zod";

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    phone: z.string().optional(),
    avatarUseMediaId: z.number().int().positive().nullable().optional(),
  }),
});

export const addAddressSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, "Full name is required"),
    phone: z.string().min(10, "Phone number is required"),
    streetAddress: z.string().min(5, "Street address is required"),
    city: z.string().min(2, "City is required"),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().default("Bangladesh"),
    isDefault: z.boolean().default(false).optional(),
    type: z.enum(["SHIPPING", "BILLING"]).default("SHIPPING"),
  }),
});

export const adminUpdateUserSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email address").optional(),
    phone: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    isVerified: z.boolean().optional(),
    role: z.enum(["CUSTOMER", "SELLER", "ADMIN"]).optional(),
  }),
});
