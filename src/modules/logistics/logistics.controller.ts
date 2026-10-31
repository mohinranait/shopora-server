import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import * as LogisticsService from "./logistics.service.ts";

export const bookCourier = catchAsync(async (req: Request, res: Response) => {
  const subOrderId = req.params.id as string;
  const courierName = req.body.courierName || "Steadfast Courier";
  const result = await LogisticsService.bookCourierConsignment(subOrderId, req.user!, courierName);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Consignment created & parcel booked with courier partner",
    data: result,
  });
});

export const trackParcel = catchAsync(async (req: Request, res: Response) => {
  const code = req.params.trackingCode as string;
  const result = await LogisticsService.trackConsignment(code);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Consignment tracking retrieved",
    data: result,
  });
});

export const getPackagingSlip = catchAsync(async (req: Request, res: Response) => {
  const subOrderId = req.params.id as string;
  const result = await LogisticsService.getPackagingSlipData(subOrderId, req.user!);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Packaging slip data retrieved",
    data: result,
  });
});
