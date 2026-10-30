import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { AnalyticsService } from "./analytics.service.ts";

export const getAdminPlatformAnalytics = catchAsync(async (_req: Request, res: Response) => {
  const result = await AnalyticsService.getAdminPlatformAnalytics();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Platform analytics retrieved successfully",
    data: result,
  });
});

export const AnalyticsController = {
  getAdminPlatformAnalytics,
};
