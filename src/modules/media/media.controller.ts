import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { AppError } from "../../errors/AppError.ts";
import * as MediaService from "./media.service.ts";

/**
 * Controller to upload a single image to Cloudinary and record it in Media
 */
export const uploadSingleMedia = catchAsync(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    throw new AppError("No image file provided in form field 'image'", 400);
  }

  const result = await MediaService.uploadSingleMedia(
    file,
    req.user!,
    req.body.folder
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Image uploaded successfully to Cloudinary and media library",
    data: result,
  });
});

/**
 * Controller to upload multiple images concurrently
 */
export const uploadMultipleMedia = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    throw new AppError("No image files provided in form field 'images'", 400);
  }

  const result = await MediaService.uploadMultipleMedia(
    files,
    req.user!,
    req.body.folder
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: `${result.length} images uploaded successfully to media library`,
    data: result,
  });
});

/**
 * Direct Upload + Auto UseMedia creation in a single step
 */
export const uploadAndUse = catchAsync(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    throw new AppError("No image file provided in form field 'image'", 400);
  }

  const result = await MediaService.uploadAndCreateUseMedia(
    file,
    req.user!,
    req.body
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Image uploaded and configured in UseMedia successfully",
    data: result,
  });
});

/**
 * Get media library items
 */
export const getMyMediaLibrary = catchAsync(async (req: Request, res: Response) => {
  const result = await MediaService.getMyMediaLibrary(req.user!, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Media library retrieved successfully",
    data: result.media,
    meta: result.meta,
  });
});

/**
 * Get single media asset by ID
 */
export const getMediaById = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await MediaService.getMediaById(id, req.user!);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Media retrieved successfully",
    data: result,
  });
});

/**
 * Delete media asset from Cloudinary and DB
 */
export const deleteMedia = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await MediaService.deleteMedia(id, req.user!);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Media deleted successfully",
    data: result,
  });
});

/**
 * Create UseMedia configuration for an existing Media record
 */
export const createUseMedia = catchAsync(async (req: Request, res: Response) => {
  const result = await MediaService.createUseMedia(req.user!, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "UseMedia record created successfully",
    data: result,
  });
});

/**
 * Get UseMedia configured items list
 */
export const getUseMediaLibrary = catchAsync(async (req: Request, res: Response) => {
  const result = await MediaService.getUseMediaLibrary(req.user!, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "UseMedia items retrieved successfully",
    data: result.useMedia,
    meta: result.meta,
  });
});

/**
 * Get single UseMedia configuration
 */
export const getUseMediaById = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await MediaService.getUseMediaById(id);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "UseMedia details retrieved successfully",
    data: result,
  });
});

/**
 * Update UseMedia alt text or description
 */
export const updateUseMedia = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await MediaService.updateUseMedia(id, req.user!, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "UseMedia updated successfully",
    data: result,
  });
});

/**
 * Delete UseMedia record
 */
export const deleteUseMedia = catchAsync(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await MediaService.deleteUseMedia(id, req.user!);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "UseMedia record deleted successfully",
    data: result,
  });
});

export const MediaController = {
  uploadSingleMedia,
  uploadMultipleMedia,
  uploadAndUse,
  getMyMediaLibrary,
  getMediaById,
  deleteMedia,
  createUseMedia,
  getUseMediaLibrary,
  getUseMediaById,
  updateUseMedia,
  deleteUseMedia,
};
