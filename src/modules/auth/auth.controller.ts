import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { AuthService } from "./auth.service.ts";
import { AppError } from "../../errors/AppError.ts";

/**
 * Handle customer registration
 */
export const registerCustomer = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.registerCustomer(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Customer account created successfully",
    data: result,
  });
});

/**
 * Handle seller registration
 */
export const registerSeller = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.registerSeller(req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Seller account created successfully. Verification pending by Admin.",
    data: result,
  });
});

/**
 * Handle user login
 */
export const login = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.loginUser(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Login successful",
    data: result,
  });
});

/**
 * Get current user profile
 */
export const getMe = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const result = await AuthService.getMe(req.user.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "User profile retrieved successfully",
    data: result,
  });
});

/**
 * Refresh access token
 */
export const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthService.refreshUserToken(req.body.refreshToken);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Access token refreshed successfully",
    data: result,
  });
});

/**
 * Change password
 */
export const changePassword = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  const result = await AuthService.changePassword(req.user.id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: result.message,
  });
});

export const AuthController = {
  registerCustomer,
  registerSeller,
  login,
  getMe,
  refreshToken,
  changePassword,
};
