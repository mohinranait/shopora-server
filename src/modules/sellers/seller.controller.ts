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
  const sellerId = Number(req.params.id);
  const result = await SellerService.adminReviewSellerApplication(sellerId, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Seller application status updated successfully",
    data: result,
  });
});

export const SellerController = {
  getStoreBySlug,
  getSellerDashboardStats,
  updateSellerProfile,
  adminGetAllSellers,
  adminReviewSellerApplication,
};
