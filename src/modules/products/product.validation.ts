import { z } from "zod";
import { PRODUCT_TYPE, PRODUCT_STATUS, PRODUCT_APPROVAL_STATUS } from "../../constants/index.ts";

/**
 * Selected Product Attribute Input Schema (for both simple and variable products)
 */
export const productSelectedAttributeSchema = z.object({
  attributeId: z.number().int().positive("attributeId must be a positive integer"),
  isVariation: z.boolean().default(false).optional(),
  values: z.array(z.union([z.number().int().positive(), z.string()])).min(1, "At least one value is required"),
});

/**
 * Variant Input Schema
 */
export const variantInputSchema = z.object({
  id: z.number().int().optional(),
  title: z.string().min(1, "Variant title is required"), // e.g. "Black / XL"
  sku: z.string().optional(),
  price: z.number().nonnegative("Variant price must be non-negative"),
  comparePrice: z.number().nonnegative().nullable().optional(),
  costPrice: z.number().nonnegative().nullable().optional(),
  stock: z.number().int().nonnegative("Variant stock cannot be negative").default(0),
  lowStockThreshold: z.number().int().default(5).optional(),
  useMediaId: z.number().int().positive().nullable().optional(),
  barcode: z.string().nullable().optional(),
  weightKg: z.number().positive().nullable().optional(),
  dimensions: z
    .object({
      length: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .nullable()
    .optional(),
  isDefault: z.boolean().default(false).optional(),
  isActive: z.boolean().default(true).optional(),
  attributeValueIds: z.array(z.number().int().positive()).optional(),
  attributes: z.record(z.string(), z.string()).optional(), // Optional cached dictionary
});

/**
 * Image Gallery Input Schema
 */
export const productImageInputSchema = z.object({
  useMediaId: z.number().int().positive("useMediaId is required for gallery image"),
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
    brandId: z.number().int().positive().nullable().optional(),
    sku: z.string().optional(),
    productType: z.enum([PRODUCT_TYPE.SIMPLE, PRODUCT_TYPE.VARIABLE]).default(PRODUCT_TYPE.SIMPLE),
    basePrice: z.number().positive("Base price must be greater than 0"),
    comparePrice: z.number().positive().nullable().optional(),
    costPrice: z.number().positive().nullable().optional(),
    stock: z.number().int().nonnegative().default(0),
    lowStockThreshold: z.number().int().default(5).optional(),
    mainImageUseMediaId: z.number().int().positive("mainImageUseMediaId is required").nullable().optional(),
    images: z.array(productImageInputSchema).optional(),
    selectedAttributes: z.array(productSelectedAttributeSchema).optional(),
    variants: z.array(variantInputSchema).optional(),
    tags: z.array(z.string()).default([]).optional(),
    warranty: z.string().optional(),
    weightKg: z.number().positive().optional(),
    dimensions: z
      .object({
        length: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      })
      .optional(),
    videoUrl: z.string().optional(),
    trackStock: z.boolean().default(true).optional(),
    isFreeShipping: z.boolean().default(false).optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    metaKeywords: z.string().optional(),
    isFeatured: z.boolean().default(false).optional(),
    isTrending: z.boolean().default(false).optional(),
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
    mainImageUseMediaId: z.number().int().positive().nullable().optional(),
    images: z.array(productImageInputSchema).optional(),
    selectedAttributes: z.array(productSelectedAttributeSchema).optional(),
    variants: z.array(variantInputSchema).optional(),
    status: z.enum([PRODUCT_STATUS.PUBLISHED, PRODUCT_STATUS.UNPUBLISHED, PRODUCT_STATUS.ARCHIVED]).optional(),
    tags: z.array(z.string()).optional(),
    warranty: z.string().optional(),
    weightKg: z.number().positive().nullable().optional(),
    dimensions: z
      .object({
        length: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      })
      .nullable()
      .optional(),
    videoUrl: z.string().optional(),
    trackStock: z.boolean().optional(),
    isFreeShipping: z.boolean().optional(),
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
    minRating: z.string().optional(),
    inStock: z.string().optional(),
    freeShipping: z.string().optional(),
    isFeatured: z.string().optional(),
    isTrending: z.string().optional(),
    sortBy: z.enum(["newest", "price_asc", "price_desc", "popular", "top_rated"]).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
