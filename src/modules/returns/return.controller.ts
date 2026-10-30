import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { ReturnService } from "./return.service.ts";

export const createReturnRequest = catchAsync(async (req: Request, res: Response) => {
  const result = await ReturnService.createReturnRequest(req.user!.id, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Return request submitted successfully",
    data: result,
  });
});

export const getCustomerReturns = catchAsync(async (req: Request, res: Response) => {
  const result = await ReturnService.getCustomerReturns(req.user!.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Return requests retrieved successfully",
    data: result,
  });
});

export const adminGetAllReturns = catchAsync(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const result = await ReturnService.adminGetAllReturns(status);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "All return requests retrieved successfully",
    data: result,
  });
});

export const adminReviewReturn = catchAsync(async (req: Request, res: Response) => {
  const returnId = req.params.id as string;
  const result = await ReturnService.adminReviewReturn(returnId, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Return request status updated successfully",
    data: result,
  });
});

export const ReturnController = {
  createReturnRequest,
  getCustomerReturns,
  adminGetAllReturns,
  adminReviewReturn,
};
