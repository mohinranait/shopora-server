/**
 * Product Module TypeScript Interfaces
 */

import type { IMediaRecord, IUseMediaWithMedia } from "../brands/brand.interface.ts";

export interface IProductFilterOptions {
  search?: string;
  category?: string;
  brand?: string; // single or comma-separated brand slugs / ids
  sellerId?: string;
  isPlatformOwned?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  isFreeShipping?: boolean;
  isFeatured?: boolean;
  isTrending?: boolean;
  sortBy?: "newest" | "price_asc" | "price_desc" | "popular" | "top_rated";
  page?: number;
  limit?: number;
  approvalStatus?: string;
  status?: string;
  sellerUserId?: string; // When seller requests their own products
  isAdmin?: boolean;
}

export type FacetKey = "category" | "brand" | "price";

export interface IResolvedFilters {
  categoryIds?: string[];
  brandIds?: string[];
  sellerProfileId?: string;
  unresolved: boolean;
}

export interface IProductAuthUser {
  id: string;
  role: string;
  sellerId?: string | null;
}

export interface IProductVariantInput {
  id?: string;
  sku?: string;
  title: string;
  price: number;
  comparePrice?: number | null;
  costPrice?: number | null;
  stock: number;
  lowStockThreshold?: number;
  imageId?: string | null;
  useMediaId?: string | null;
  barcode?: string | null;
  weightKg?: number | null;
  dimensions?: { length?: number; width?: number; height?: number } | null;
  isDefault?: boolean;
  isActive?: boolean;
  attributes?: Record<string, string>;
  attributeValueIds?: string[];
  attributeValues?: Array<{
    attributeId: string;
    attributeValueId: string;
  }>;
}

export interface IProductImageInput {
  imageId?: string | null;
  useMediaId?: string | null;
  url?: string | null;
  altText?: string | null;
  displayOrder?: number;
  isPrimary?: boolean;
}

export interface IProductSelectedAttributeInput {
  attributeId: string;
  isVariation?: boolean;
  values: Array<string | number>;
}

export interface IProductCreateInput {
  name: string;
  sku?: string;
  shortDescription?: string | null;
  description: string;
  categoryId: string;
  brandId?: string | null;
  productType?: "SIMPLE" | "VARIABLE";
  basePrice: number;
  comparePrice?: number | null;
  costPrice?: number | null;
  stock?: number;
  lowStockThreshold?: number;
  mainImageId?: string | null;
  mainImageUseMediaId?: string | null;
  galleryImageIds?: string[];
  images?: IProductImageInput[];
  tags?: string[];
  bundleProductIds?: string[];
  warranty?: string | null;
  weightKg?: number | null;
  dimensions?: { length?: number; width?: number; height?: number } | null;
  videoUrl?: string | null;
  trackStock?: boolean;
  isFreeShipping?: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
  isFeatured?: boolean;
  isTrending?: boolean;
  selectedAttributes?: IProductSelectedAttributeInput[];
  variants?: IProductVariantInput[];
}

export interface IProductUpdateInput extends Partial<IProductCreateInput> {
  status?: string;
  approvalStatus?: string;
  rejectionReason?: string | null;
}

export interface IProductVariantAttributeDetail {
  id: string;
  attributeId: string;
  attributeName: string;
  attributeSlug: string;
  attributeValueId: string;
  value: string;
  colorCode: string | null;
}

export interface IProductVariantDetail {
  id: string;
  productId: string;
  sku: string;
  title: string;
  price: number;
  comparePrice: number | null;
  costPrice?: number | null;
  stock: number;
  lowStockThreshold: number;
  imageId: string | null;
  barcode: string | null;
  weightKg: number | null;
  dimensions: { length?: number; width?: number; height?: number } | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  useMedia: IUseMediaWithMedia | null;
  image: string | null;
  attributeValues: IProductVariantAttributeDetail[];
  attributeValueIds: string[];
}

export interface IProductImageDetail {
  id: string;
  productId: string;
  imageId: string | null;
  displayOrder: number;
  isPrimary: boolean;
  createdAt: string;
  useMedia: IUseMediaWithMedia | null;
  url: string;
}

export interface IProductSelectedAttributeValue {
  id: string;
  attributeValueId: string | null;
  value: string;
  customValue?: string | null;
  colorCode: string | null;
  displayOrder: number;
}

export interface IProductSelectedAttributeDetail {
  id: string;
  attributeId: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  isVariation: boolean;
  values: IProductSelectedAttributeValue[];
}

export interface IProductDetail {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string | null;
  description: string;
  categoryId: string;
  brandId: string | null;
  sellerId: string | null;
  isPlatformOwned: boolean;
  approvalStatus: string;
  rejectionReason: string | null;
  status: string;
  productType: string;
  basePrice: number;
  comparePrice: number | null;
  costPrice?: number | null;
  stock: number;
  lowStockThreshold: number;
  mainImageId: string | null;
  ratingAverage: number;
  ratingCount: number;
  totalSold: number;
  tags: string[];
  bundleProductIds: string[];
  warranty: string | null;
  weightKg: number | null;
  dimensions: { length?: number; width?: number; height?: number } | null;
  videoUrl: string | null;
  trackStock: boolean;
  isFreeShipping: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  isFeatured: boolean;
  isTrending: boolean;
  createdAt: string;
  updatedAt: string;
  category: any;
  brand: any;
  seller: any;
  mainImage: any;
  mainUseMedia?: IUseMediaWithMedia | null;
  images: any[];
  selectedAttributes: any[];
  variants: any[];
  reviews: any[];
}
