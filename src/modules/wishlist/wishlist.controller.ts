import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { WishlistService } from "./wishlist.service.ts";

export const toggleWishlist = catchAsync(async (req: Request, res: Response) => {
  const productId = Number(req.body.productId);
  const result = await WishlistService.toggleWishlistItem(req.user!.id, productId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
    data: result,
  });
});

export const getUserWishlist = catchAsync(async (req: Request, res: Response) => {
  const result = await WishlistService.getUserWishlist(req.user!.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Wishlist retrieved successfully",
    data: result,
  });
});

export const removeWishlistItem = catchAsync(async (req: Request, res: Response) => {
  const productId = Number(req.params.productId);
  const result = await WishlistService.removeWishlistItem(req.user!.id, productId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
  });
});

export const WishlistController = {
  toggleWishlist,
  getUserWishlist,
  removeWishlistItem,
};
