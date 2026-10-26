import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { SliderService } from "./slider.service.ts";

export const getSliders = catchAsync(async (req: Request, res: Response) => {
  const includeInactive = req.query.includeInactive === "true";
  const result = await SliderService.getSliders(includeInactive);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Sliders retrieved successfully",
    data: result,
  });
});

export const getSliderById = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await SliderService.getSliderById(id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Slider retrieved successfully",
    data: result,
  });
});

export const createSlider = catchAsync(async (req: Request, res: Response) => {
  const result = await SliderService.createSlider(req.body);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Slider created successfully",
    data: result,
  });
});

export const updateSlider = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await SliderService.updateSlider(id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Slider updated successfully",
    data: result,
  });
});

export const deleteSlider = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await SliderService.deleteSlider(id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Slider deleted successfully",
  });
});

export const SliderController = {
  getSliders,
  getSliderById,
  createSlider,
  updateSlider,
  deleteSlider,
};
