import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { BrandService } from "./brand.service.ts";
import { db } from "../../config/db.ts";

export const getAllBrands = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as any;
  const includeInactive =
    query.includeInactive === "true" || query.status === "all" || query.status === "inactive";
  const search = query.search ? String(query.search).trim() : undefined;
  const status = query.status as "all" | "active" | "inactive" | undefined;
  const page = query.page ? Number(query.page) : undefined;
  const limit = query.limit ? Number(query.limit) : undefined;

  const result = await BrandService.getAllBrands({
    includeInactive,
    status,
    search,
    page,
    limit,
  });

  // Calculate live tab counts for Brand tabs (all, active, inactive)
  const [totalAll, totalActive, totalInactive] = await Promise.all([
    db.orm.public.Brand.aggregate((a) => ({ count: a.count() })),
    db.orm.public.Brand.where({ isActive: true }).aggregate((a) => ({ count: a.count() })),
    db.orm.public.Brand.where({ isActive: false }).aggregate((a) => ({ count: a.count() })),
  ]);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Brands retrieved successfully",
    meta: {
      ...result.meta,
      counts: {
        all: Number(totalAll.count) || 0,
        active: Number(totalActive.count) || 0,
        inactive: Number(totalInactive.count) || 0,
      },
    },
    data: result.brands,
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
  const id = req.params.id as string;
  const result = await BrandService.updateBrand(id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Brand updated successfully",
    data: result,
  });
});

export const deleteBrand = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
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
