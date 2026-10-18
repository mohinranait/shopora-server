import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { CartService } from "./cart.service.ts";

export const getCart = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user ? req.user.id : null;
  const sessionId = req.headers["x-session-id"] as string | undefined;

  const result = await CartService.getCart(userId, sessionId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Cart retrieved successfully",
    data: result,
  });
});

export const addToCart = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user ? req.user.id : null;
  const sessionId = req.headers["x-session-id"] as string | undefined;

  const result = await CartService.addToCart(userId, sessionId, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Item added to cart",
    data: result,
  });
});

export const updateCartItemQuantity = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user ? req.user.id : null;
  const sessionId = req.headers["x-session-id"] as string | undefined;
  const itemId = Number(req.params.id);

  const result = await CartService.updateCartItemQuantity(
    itemId,
    userId,
    sessionId,
    req.body.quantity
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Cart updated",
    data: result,
  });
});

export const removeCartItem = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user ? req.user.id : null;
  const itemId = Number(req.params.id);

  await CartService.removeCartItem(itemId, userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Item removed from cart",
  });
});

export const clearCart = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user ? req.user.id : null;
  const sessionId = req.headers["x-session-id"] as string | undefined;

  const result = await CartService.clearCart(userId, sessionId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
  });
});

export const CartController = {
  getCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
};
