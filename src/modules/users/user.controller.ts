import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { UserService } from "./user.service.ts";

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.updateProfile(req.user!.id, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

export const addAddress = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.addAddress(req.user!.id, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Address saved successfully",
    data: result,
  });
});

export const getUserAddresses = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getUserAddresses(req.user!.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Addresses retrieved successfully",
    data: result,
  });
});

export const deleteAddress = catchAsync(async (req: Request, res: Response) => {
  const addressId = Number(req.params.id);
  await UserService.deleteAddress(addressId, req.user!.id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Address deleted successfully",
  });
});

export const adminGetAllUsers = catchAsync(async (req: Request, res: Response) => {
  const filters = {
    role: req.query.role as string | undefined,
    isActive: req.query.isActive !== undefined ? req.query.isActive === "true" : undefined,
    isVerified: req.query.isVerified !== undefined ? req.query.isVerified === "true" : undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
  };

  const result = await UserService.adminGetAllUsers(filters);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Users retrieved successfully",
    meta: result.meta,
    data: result.users,
  });
});

export const adminGetUserDetail = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const result = await UserService.adminGetUserDetail(userId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Customer details retrieved successfully",
    data: result,
  });
});

export const adminUpdateUser = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const result = await UserService.adminUpdateUser(userId, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Customer updated successfully",
    data: result,
  });
});

export const adminToggleUserStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const isActive = req.body.isActive === true;
  const result = await UserService.adminToggleUserStatus(userId, isActive);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `User account ${isActive ? "activated" : "deactivated"} successfully`,
    data: result,
  });
});

export const UserController = {
  updateProfile,
  addAddress,
  getUserAddresses,
  deleteAddress,
  adminGetAllUsers,
  adminGetUserDetail,
  adminUpdateUser,
  adminToggleUserStatus,
};
