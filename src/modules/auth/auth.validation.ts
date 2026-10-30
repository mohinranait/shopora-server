import { z } from "zod";

/**
 * Customer Registration Validation
 */
export const registerCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters long"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
    phone: z.string().optional(),
  }),
});

/**
 * Seller Registration Validation
 */
export const registerSellerSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters long"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters long"),
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    storeName: z.string().min(3, "Store name must be at least 3 characters"),
    storeDescription: z.string().optional(),
    businessAddress: z.string().min(5, "Business address is required"),
    taxNumber: z.string().optional(),
    nidOrTradeLicense: z.string().optional(),
    bankName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankRouting: z.string().optional(),
    bkashOrNagad: z.string().optional(),
  }),
});

/**
 * Login Validation
 */
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  }),
});

/**
 * Change Password Validation
 */
export const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters long"),
  }),
});

/**
 * Refresh Token Validation
 */
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
});
