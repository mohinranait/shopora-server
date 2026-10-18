import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { ProductService, type IProductFilterOptions } from "./product.service.ts";
import { USER_ROLES } from "../../constants/index.ts";

/**
 * Get all products with filters and search
 */
export const getAllProducts = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as any;

  const filters: IProductFilterOptions = {
    search: query.search,
    category: query.category,
    brand: query.brand,
    sellerId: query.sellerId ? Number(query.sellerId) : undefined,
    isPlatformOwned: query.isPlatformOwned !== undefined ? query.isPlatformOwned === "true" : undefined,
    minPrice: query.minPrice ? Number(query.minPrice) : undefined,
    maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
    inStock: query.inStock === "true",
    isFeatured: query.isFeatured === "true" ? true : undefined,
    isTrending: query.isTrending === "true" ? true : undefined,
    sortBy: query.sortBy,
    page: query.page ? Number(query.page) : 1,
    limit: query.limit ? Number(query.limit) : 12,
  };

  const result = await ProductService.getAllProducts(filters);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Products retrieved successfully",
    meta: result.meta,
    data: result.products,
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
  getProductBySlug,
  getSellerProducts,
  getAdminProducts,
  createProduct,
  updateProduct,
  reviewProductApproval,
  deleteProduct,
};
