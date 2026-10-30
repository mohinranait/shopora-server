import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { ReviewService } from "./review.service.ts";

export const createReview = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.createReview(req.user!.id, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Review submitted successfully",
    data: result,
  });
});

export const getProductReviews = catchAsync(async (req: Request, res: Response) => {
  const productId = Number(req.params.productId);
  const result = await ReviewService.getProductReviews(productId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product reviews retrieved successfully",
    data: result,
  });
});

export const adminModerateReview = catchAsync(async (req: Request, res: Response) => {
  const reviewId = Number(req.params.id);
  const isApproved = req.body.isApproved === true;
  const result = await ReviewService.adminModerateReview(reviewId, isApproved);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Review ${isApproved ? "approved" : "rejected"} successfully`,
    data: result,
  });
});

export const ReviewController = {
  createReview,
  getProductReviews,
  adminModerateReview,
};
