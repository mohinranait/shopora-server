import { z } from "zod";
import { PRODUCT_TYPE, PRODUCT_STATUS, PRODUCT_APPROVAL_STATUS } from "../../constants/index.ts";

/**
 * Variant Input Schema
 */
export const variantInputSchema = z.object({
  id: z.number().int().optional(),
  title: z.string().min(1, "Variant title is required"), // e.g. "Black / XL"
  sku: z.string().optional(),
  price: z.number().positive("Variant price must be positive"),
  comparePrice: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),
  stock: z.number().int().nonnegative("Variant stock cannot be negative").default(0),
  image: z.string().optional(),
  useMediaId: z.number().int().positive().nullable().optional(),
  attributes: z.record(z.string(), z.string()), // e.g. {"Color": "Black", "Size": "XL"}
  barcode: z.string().optional(),
  isActive: z.boolean().default(true).optional(),
});

/**
 * Image Gallery Input Schema
 */
export const productImageInputSchema = z.object({
  url: z.string().optional(),
  useMediaId: z.number().int().positive().optional(),
  altText: z.string().optional(),
  displayOrder: z.number().int().default(0).optional(),
  isPrimary: z.boolean().default(false).optional(),
});

/**
 * Create Product Schema
 */
export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(3, "Product name must be at least 3 characters"),
    shortDescription: z.string().optional(),
    description: z.string().min(10, "Product description is required"),
    categoryId: z.number().int().positive("Category is required"),
    brandId: z.number().int().positive().optional(),
    productType: z.enum([PRODUCT_TYPE.SIMPLE, PRODUCT_TYPE.VARIABLE]).default(PRODUCT_TYPE.SIMPLE),
    basePrice: z.number().positive("Base price must be greater than 0"),
    comparePrice: z.number().positive().optional(),
    costPrice: z.number().positive().optional(),
    stock: z.number().int().nonnegative().default(0),
    lowStockThreshold: z.number().int().default(5).optional(),
    mainImage: z.string().optional(),
    mainImageUseMediaId: z.number().int().positive().optional(),
    images: z.array(productImageInputSchema).optional(),
    variants: z.array(variantInputSchema).optional(),
    tags: z.array(z.string()).default([]).optional(),
    warranty: z.string().optional(),
    weightKg: z.number().positive().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    metaKeywords: z.string().optional(),
    isFeatured: z.boolean().default(false).optional(),
    isTrending: z.boolean().default(false).optional(),
  }).refine((data) => data.mainImage || data.mainImageUseMediaId, {
    message: "Either mainImage URL or mainImageUseMediaId is required",
    path: ["mainImageUseMediaId"],
  }),
});

/**
 * Update Product Schema
 */
export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(3).optional(),
    shortDescription: z.string().optional(),
    description: z.string().min(10).optional(),
    categoryId: z.number().int().positive().optional(),
    brandId: z.number().int().positive().nullable().optional(),
    productType: z.enum([PRODUCT_TYPE.SIMPLE, PRODUCT_TYPE.VARIABLE]).optional(),
    basePrice: z.number().positive().optional(),
    comparePrice: z.number().positive().nullable().optional(),
    costPrice: z.number().positive().nullable().optional(),
    stock: z.number().int().nonnegative().optional(),
    lowStockThreshold: z.number().int().optional(),
    mainImage: z.string().optional(),
    mainImageUseMediaId: z.number().int().positive().nullable().optional(),
    images: z.array(productImageInputSchema).optional(),
    variants: z.array(variantInputSchema).optional(),
    status: z.enum([PRODUCT_STATUS.PUBLISHED, PRODUCT_STATUS.UNPUBLISHED, PRODUCT_STATUS.ARCHIVED]).optional(),
    tags: z.array(z.string()).optional(),
    warranty: z.string().optional(),
    weightKg: z.number().positive().nullable().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    metaKeywords: z.string().optional(),
    isFeatured: z.boolean().optional(),
    isTrending: z.boolean().optional(),
  }),
});

/**
 * Admin Product Approval Schema
 */
export const reviewProductApprovalSchema = z.object({
  body: z.object({
    status: z.enum([PRODUCT_APPROVAL_STATUS.APPROVED, PRODUCT_APPROVAL_STATUS.REJECTED]),
    rejectionReason: z.string().optional(),
  }),
});

/**
 * Product Query / Filter Schema
 */
export const productFilterQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    category: z.string().optional(), // category slug or id
    brand: z.string().optional(), // brand slug or id
    sellerId: z.string().optional(),
    isPlatformOwned: z.string().optional(), // "true" | "false"
    minPrice: z.string().optional(),
    maxPrice: z.string().optional(),
    inStock: z.string().optional(),
    isFeatured: z.string().optional(),
    isTrending: z.string().optional(),
    sortBy: z.enum(["newest", "price_asc", "price_desc", "popular", "top_rated"]).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
