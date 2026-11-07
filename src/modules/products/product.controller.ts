import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { ProductService, type IProductFilterOptions } from "./product.service.ts";
import { USER_ROLES } from "../../constants/index.ts";
import { AppError } from "../../errors/AppError.ts";
import { db } from "../../config/db.ts";

/**
 * Get all products with filters and search
 */
const parsePublicFilters = (query: any): IProductFilterOptions => {
  const num = (v: unknown) => {
    const n = Number(v);
    return v !== undefined && v !== "" && Number.isFinite(n) ? n : undefined;
  };
  return {
    search: query.search,
    category: query.category,
    brand: query.brand,
    sellerId: query.sellerId ? String(query.sellerId) : undefined,
    isPlatformOwned: query.isPlatformOwned !== undefined ? query.isPlatformOwned === "true" : undefined,
    minPrice: num(query.minPrice),
    maxPrice: num(query.maxPrice),
    minRating: num(query.minRating),
    inStock: query.inStock === "true",
    isFreeShipping: query.freeShipping === "true",
    isFeatured: query.isFeatured === "true" ? true : undefined,
    isTrending: query.isTrending === "true" ? true : undefined,
    sortBy: query.sortBy,
    page: num(query.page) ?? 1,
    limit: num(query.limit) ?? 12,
  };
};

export const getAllProducts = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.getAllProducts(parsePublicFilters(req.query));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Products retrieved successfully",
    meta: result.meta,
    data: result.products,
  });
});

/**
 * Get filter facets (category/brand counts, price range) for the storefront
 */
export const getProductFilters = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.getProductFilters(parsePublicFilters(req.query));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product filters retrieved successfully",
    data: result,
  });
});

/**
 * Get single product by slug
 */
export const getProductBySlug = catchAsync(async (req: Request, res: Response) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const result = await ProductService.getProductBySlug(slug, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product details retrieved successfully",
    data: result,
  });
});

/**
 * Get single product by ID
 */
export const getProductById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await ProductService.getProductById(id, req.user);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product details retrieved successfully",
    data: result,
  });
});

/**
 * Seller view their own products
 */
export const getSellerProducts = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as any;

  const filters: IProductFilterOptions = {
    search: query.search ? String(query.search).trim() : undefined,
    approvalStatus: query.approvalStatus ? String(query.approvalStatus) : undefined,
    status: query.status ? String(query.status) : undefined,
    isLowStock:
      query.isLowStock !== undefined && query.isLowStock !== ""
        ? query.isLowStock === "true" || query.isLowStock === true
        : undefined,
    sellerUserId: req.user!.id,
    page: query.page ? Number(query.page) : 1,
    limit: query.limit ? Number(query.limit) : 10,
  };

  const result = await ProductService.getAllProducts(filters);

  // Compute live tab counts for Seller's products
  const seller = await db.orm.public.SellerProfile.where({ userId: req.user!.id }).first();
  let counts = { all: 0, approved: 0, pending: 0, rejected: 0, lowStock: 0 };
  if (seller) {
    const [totalAll, totalApproved, totalPending, totalRejected, totalLowStock] = await Promise.all([
      db.orm.public.Product.where({ sellerId: seller.id }).aggregate((a) => ({ count: a.count() })),
      db.orm.public.Product.where({ sellerId: seller.id, approvalStatus: "APPROVED" }).aggregate((a) => ({ count: a.count() })),
      db.orm.public.Product.where({ sellerId: seller.id, approvalStatus: "PENDING" }).aggregate((a) => ({ count: a.count() })),
      db.orm.public.Product.where({ sellerId: seller.id, approvalStatus: "REJECTED" }).aggregate((a) => ({ count: a.count() })),
      db.orm.public.Product.where({ sellerId: seller.id }).where((p) => p.stock.lte(p.lowStockThreshold)).aggregate((a) => ({ count: a.count() })),
    ]);
    counts = {
      all: Number(totalAll.count) || 0,
      approved: Number(totalApproved.count) || 0,
      pending: Number(totalPending.count) || 0,
      rejected: Number(totalRejected.count) || 0,
      lowStock: Number(totalLowStock.count) || 0,
    };
  }

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller products retrieved successfully",
    meta: {
      ...result.meta,
      counts,
    },
    data: result.products,
  });
});

/**
 * Admin view all products with status filter
 */
export const getAdminProducts = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as any;

  const filters: IProductFilterOptions = {
    search: query.search ? String(query.search).trim() : undefined,
    approvalStatus: query.approvalStatus ? String(query.approvalStatus) : undefined,
    status: query.status ? String(query.status) : undefined,
    isPlatformOwned:
      query.isPlatformOwned !== undefined && query.isPlatformOwned !== ""
        ? query.isPlatformOwned === "true" || query.isPlatformOwned === true
        : undefined,
    isLowStock:
      query.isLowStock !== undefined && query.isLowStock !== ""
        ? query.isLowStock === "true" || query.isLowStock === true
        : undefined,
    isAdmin: true,
    page: query.page ? Number(query.page) : 1,
    limit: query.limit ? Number(query.limit) : 10,
  };

  const result = await ProductService.getAllProducts(filters);

  // Compute live tab counts for Admin dashboard
  const [totalAll, totalPlatform, totalVendor, totalPending, totalLowStock] = await Promise.all([
    db.orm.public.Product.aggregate((a) => ({ count: a.count() })),
    db.orm.public.Product.where({ isPlatformOwned: true }).aggregate((a) => ({ count: a.count() })),
    db.orm.public.Product.where({ isPlatformOwned: false }).aggregate((a) => ({ count: a.count() })),
    db.orm.public.Product.where({ approvalStatus: "PENDING" }).aggregate((a) => ({ count: a.count() })),
    db.orm.public.Product.where((p) => p.stock.lte(p.lowStockThreshold)).aggregate((a) => ({ count: a.count() })),
  ]);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin products retrieved successfully",
    meta: {
      ...result.meta,
      counts: {
        all: Number(totalAll.count) || 0,
        platform: Number(totalPlatform.count) || 0,
        vendor: Number(totalVendor.count) || 0,
        pending: Number(totalPending.count) || 0,
        lowStock: Number(totalLowStock.count) || 0,
      },
    },
    data: result.products,
  });
});

/**
 * Create a new product (Admin or Seller)
 */
export const createProduct = catchAsync(async (req: Request, res: Response) => {
  const result = await ProductService.createProduct(req.user!, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message:
      req.user!.role === USER_ROLES.ADMIN
        ? "Product created and published successfully"
        : "Product submitted for review. It will be published once approved by admin.",
    data: result,
  });
});

/**
 * Update product
 */
export const updateProduct = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await ProductService.updateProduct(id, req.user!, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product updated successfully",
    data: result,
  });
});

/**
 * Admin Review Product Approval
 */
export const reviewProductApproval = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await ProductService.reviewProductApproval(id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Product ${req.body.status.toLowerCase()} successfully`,
    data: result,
  });
});

/**
 * Delete product
 */
export const deleteProduct = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await ProductService.deleteProduct(id, req.user!);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
  });
});

export const getAutocomplete = catchAsync(async (req: Request, res: Response) => {
  const query = (req.query.q as string) || "";
  const result = await ProductService.getAutocompleteSuggestions(query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Autocomplete suggestions retrieved",
    data: result,
  });
});

export const getBundle = catchAsync(async (req: Request, res: Response) => {
  const productId = req.params.id as string;
  const result = await ProductService.getProductBundleRecommendations(productId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Bundle recommendations retrieved",
    data: result,
  });
});

export const ProductController = {
  getAllProducts,
  getProductFilters,
  getProductBySlug,
  getProductById,
  getSellerProducts,
  getAdminProducts,
  createProduct,
  updateProduct,
  reviewProductApproval,
  deleteProduct,
  getAutocomplete,
  getBundle,
};
