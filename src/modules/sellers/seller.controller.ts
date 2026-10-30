import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { SellerService } from "./seller.service.ts";

export const getStoreBySlug = catchAsync(async (req: Request, res: Response) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const result = await SellerService.getStoreBySlug(slug);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller store retrieved successfully",
    data: result,
  });
});

export const getPublicStores = catchAsync(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const result = await SellerService.getPublicStores({
    search: q.search,
    sortBy: q.sortBy as any,
    verifiedOnly: q.verified === "true",
    page: q.page ? Number(q.page) : 1,
    limit: q.limit ? Number(q.limit) : 24,
  });
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Stores retrieved successfully",
    meta: result.meta,
    data: result.stores,
  });
});

export const getPublicStoreBySlug = catchAsync(async (req: Request, res: Response) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const result = await SellerService.getPublicStoreBySlug(slug);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Store retrieved successfully",
    data: result,
  });
});

export const getSellerDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const result = await SellerService.getSellerDashboardStats(req.user!.id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller dashboard metrics retrieved successfully",
    data: result,
  });
});

export const updateSellerProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await SellerService.updateSellerProfile(req.user!.id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller profile updated successfully",
    data: result,
  });
});

export const adminGetAllSellers = catchAsync(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const result = await SellerService.adminGetAllSellers(status);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Sellers list retrieved successfully",
    data: result,
  });
});

export const adminReviewSellerApplication = catchAsync(async (req: Request, res: Response) => {
  const sellerId = req.params.id as string;
  const result = await SellerService.adminReviewSellerApplication(sellerId, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller application status updated successfully",
    data: result,
  });
});

export const adminGetSellerDetails = catchAsync(async (req: Request, res: Response) => {
  const sellerId = req.params.id as string;
  const result = await SellerService.adminGetSellerDetails(sellerId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller comprehensive details retrieved successfully",
    data: result,
  });
});

export const adminSendSellerNotice = catchAsync(async (req: Request, res: Response) => {
  const sellerId = req.params.id as string;
  const { title, message } = req.body;
  const result = await SellerService.adminSendSellerNotice(sellerId, title, message);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: result,
  });
});

export const SellerController = {
  getStoreBySlug,
  getPublicStores,
  getPublicStoreBySlug,
  getSellerDashboardStats,
  updateSellerProfile,
  adminGetAllSellers,
  adminGetSellerDetails,
  adminReviewSellerApplication,
  adminSendSellerNotice,
};