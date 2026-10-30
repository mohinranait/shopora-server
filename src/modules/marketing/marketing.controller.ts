import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { MarketingService } from "./marketing.service.ts";

export const validateCoupon = catchAsync(async (req: Request, res: Response) => {
  const { code, orderAmount } = req.body;
  const result = await MarketingService.validateCoupon(code, Number(orderAmount));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Coupon is valid",
    data: result,
  });
});

export const createCoupon = catchAsync(async (req: Request, res: Response) => {
  const result = await MarketingService.createCoupon(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Coupon created successfully",
    data: result,
  });
});

export const getAllCoupons = catchAsync(async (_req: Request, res: Response) => {
  const result = await MarketingService.getAllCoupons();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Coupons retrieved successfully",
    data: result,
  });
});

export const deleteCoupon = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await MarketingService.deleteCoupon(id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Coupon deleted successfully",
  });
});

export const getActiveBanners = catchAsync(async (req: Request, res: Response) => {
  const position = req.query.position as string | undefined;
  const result = await MarketingService.getActiveBanners(position);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Banners retrieved successfully",
    data: result,
  });
});

export const createBanner = catchAsync(async (req: Request, res: Response) => {
  const result = await MarketingService.createBanner(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Banner created successfully",
    data: result,
  });
});

export const getAllBanners = catchAsync(async (_req: Request, res: Response) => {
  const result = await MarketingService.getAllBanners();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All banners retrieved successfully",
    data: result,
  });
});

export const deleteBanner = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await MarketingService.deleteBanner(id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Banner deleted successfully",
  });
});

export const MarketingController = {
  validateCoupon,
  createCoupon,
  getAllCoupons,
  deleteCoupon,
  getActiveBanners,
  createBanner,
  getAllBanners,
  deleteBanner,
};
