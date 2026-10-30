import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { PayoutService } from "./payout.service.ts";

export const getSellerWallet = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.getSellerWallet(req.user!.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Wallet details retrieved successfully",
    data: result,
  });
});

export const requestPayout = catchAsync(async (req: Request, res: Response) => {
  const result = await PayoutService.requestPayout(req.user!.id, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Payout withdrawal request submitted successfully",
    data: result,
  });
});

export const adminGetAllPayouts = catchAsync(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const result = await PayoutService.adminGetAllPayouts(status);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payout requests retrieved successfully",
    data: result,
  });
});

export const adminProcessPayout = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await PayoutService.adminProcessPayout(id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Payout request updated successfully",
    data: result,
  });
});

export const PayoutController = {
  getSellerWallet,
  requestPayout,
  adminGetAllPayouts,
  adminProcessPayout,
};
