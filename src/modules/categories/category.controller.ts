import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { CategoryService } from "./category.service.ts";

export const getCategoryTree = catchAsync(async (_req: Request, res: Response) => {
  const result = await CategoryService.getCategoryTree();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Category tree retrieved successfully",
    data: result,
  });
});

export const getAllCategories = catchAsync(async (req: Request, res: Response) => {
  const includeInactive = req.query.includeInactive === "true";
  const result = await CategoryService.getAllCategories(includeInactive);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Categories retrieved successfully",
    data: result,
  });
});

export const getCategoryBySlug = catchAsync(async (req: Request, res: Response) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const result = await CategoryService.getCategoryBySlug(slug);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Category details retrieved successfully",
    data: result,
  });
});

export const createCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await CategoryService.createCategory(req.body);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Category created successfully",
    data: result,
  });
});

export const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await CategoryService.updateCategory(id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Category updated successfully",
    data: result,
  });
});

export const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await CategoryService.deleteCategory(id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Category deleted successfully",
    data: result,
  });
});

export const CategoryController = {
  getCategoryTree,
  getAllCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
};
