import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import { AttributeService } from "./attribute.service.ts";

/**
 * Create a new global attribute
 */
export const createAttribute = catchAsync(async (req: Request, res: Response) => {
  const result = await AttributeService.createAttribute(req.body);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Attribute created successfully",
    data: result,
  });
});

/**
 * Get all attributes with their values
 */
export const getAllAttributes = catchAsync(async (req: Request, res: Response) => {
  const includeInactive = req.query.includeInactive === "true";
  const result = await AttributeService.getAllAttributes(includeInactive);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attributes retrieved successfully",
    data: result,
  });
});

/**
 * Get single attribute by ID
 */
export const getAttributeById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await AttributeService.getAttributeById(id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attribute details retrieved successfully",
    data: result,
  });
});

/**
 * Update an existing attribute
 */
export const updateAttribute = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await AttributeService.updateAttribute(id, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attribute updated successfully",
    data: result,
  });
});

/**
 * Delete an attribute
 */
export const deleteAttribute = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await AttributeService.deleteAttribute(id);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attribute deleted successfully",
    data: result,
  });
});

/**
 * Add a value to an attribute
 */
export const createAttributeValue = catchAsync(async (req: Request, res: Response) => {
  const attributeId = req.params.id as string;
  const result = await AttributeService.createAttributeValue(attributeId, req.body);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Attribute value added successfully",
    data: result,
  });
});

/**
 * Update an attribute value
 */
export const updateAttributeValue = catchAsync(async (req: Request, res: Response) => {
  const valueId = req.params.valueId as string;
  const result = await AttributeService.updateAttributeValue(valueId, req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attribute value updated successfully",
    data: result,
  });
});

/**
 * Delete an attribute value
 */
export const deleteAttributeValue = catchAsync(async (req: Request, res: Response) => {
  const valueId = req.params.valueId as string;
  const result = await AttributeService.deleteAttributeValue(valueId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Attribute value deleted successfully",
    data: result,
  });
});

/**
 * Generate Cartesian product combinations when user clicks "Generate" in UI
 */
export const generateCombinations = catchAsync(async (req: Request, res: Response) => {
  const result = await AttributeService.generateVariantCombinations(req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Variant combinations generated successfully",
    data: result,
  });
});

export const AttributeController = {
  createAttribute,
  getAllAttributes,
  getAttributeById,
  updateAttribute,
  deleteAttribute,
  createAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
  generateCombinations,
};
