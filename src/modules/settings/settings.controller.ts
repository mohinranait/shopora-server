import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { SettingsService } from "./settings.service.ts";

export const getAllSettings = catchAsync(async (_req: Request, res: Response) => {
  const result = await SettingsService.getAllSettings();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Website settings retrieved successfully",
    data: result,
  });
});

export const updateSettings = catchAsync(async (req: Request, res: Response) => {
  const result = await SettingsService.updateSettings(req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Website settings updated successfully",
    data: result,
  });
});

export const SettingsController = {
  getAllSettings,
  updateSettings,
};
