import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { ProductService, type IProductFilterOptions } from "./product.service.ts";
import { USER_ROLES } from "../../constants/index.ts";
import { AppError } from "../../errors/AppError.ts";

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
    sellerId: num(query.sellerId),
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
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    throw new AppError("Invalid product ID", 400);
  }
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
    search: query.search,
    approvalStatus: query.approvalStatus,
    status: query.status,
    sellerUserId: req.user!.id,
    page: query.page ? Number(query.page) : 1,
    limit: query.limit ? Number(query.limit) : 20,
  };

  const result = await ProductService.getAllProducts(filters);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller products retrieved successfully",
    meta: result.meta,
    data: result.products,
  });
});

/**
 * Admin view all products with status filter
 */
export const getAdminProducts = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as any;

  const filters: IProductFilterOptions = {
    search: query.search,
    approvalStatus: query.approvalStatus,
    status: query.status,
    isAdmin: true,
    page: query.page ? Number(query.page) : 1,
    limit: query.limit ? Number(query.limit) : 20,
  };

  const result = await ProductService.getAllProducts(filters);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Admin products retrieved successfully",
    meta: result.meta,
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
  const id = Number(req.params.id);
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
  const id = Number(req.params.id);
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
  const id = Number(req.params.id);
  const result = await ProductService.deleteProduct(id, req.user!);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
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
};
