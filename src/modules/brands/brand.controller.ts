import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { BrandService } from "./brand.service.ts";

export const getAllBrands = catchAsync(async (req: Request, res: Response) => {
  const includeInactive = req.query.includeInactive === "true";
  const result = await BrandService.getAllBrands(includeInactive);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Brands retrieved successfully",
    data: result,
  });
});

export const getBrandBySlug = catchAsync(async (req: Request, res: Response) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const result = await BrandService.getBrandBySlug(slug);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Brand details retrieved successfully",
    data: result,
  });
});

export const createBrand = catchAsync(async (req: Request, res: Response) => {
  const result = await BrandService.createBrand(req.body);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Brand created successfully",
    data: result,
  });
});

export const updateBrand = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await BrandService.updateBrand(id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Brand updated successfully",
    data: result,
  });
});

export const deleteBrand = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await BrandService.deleteBrand(id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Brand deleted successfully",
    data: result,
  });
});

export const BrandController = {
  getAllBrands,
  getBrandBySlug,
  createBrand,
  updateBrand,
  deleteBrand,
};
