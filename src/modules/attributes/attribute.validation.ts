import { z } from "zod";

/**
 * Validation schema for creating a global product attribute
 */
export const createAttributeSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Attribute name must be at least 2 characters"), // e.g. "Color", "Size", "Storage"
    type: z.enum(["TEXT", "COLOR", "BUTTON", "SELECT", "RADIO"]).default("SELECT"),
    description: z.string().optional(),
    displayOrder: z.number().int().default(0).optional(),
    isActive: z.boolean().default(true).optional(),
    values: z
      .array(
        z.object({
          value: z.string().min(1, "Value cannot be empty"),
          colorCode: z.string().optional(), // e.g. "#FF0000" for visual color swatches
          displayOrder: z.number().int().default(0).optional(),
        })
      )
      .optional(),
  }),
});

/**
 * Validation schema for updating a product attribute
 */
export const updateAttributeSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    type: z.enum(["TEXT", "COLOR", "BUTTON", "SELECT", "RADIO"]).optional(),
    description: z.string().optional(),
    displayOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

/**
 * Validation schema for adding a value to an attribute
 */
export const createAttributeValueSchema = z.object({
  body: z.object({
    value: z.string().min(1, "Value is required"),
    colorCode: z.string().optional(),
    displayOrder: z.number().int().default(0).optional(),
  }),
});

/**
 * Validation schema for updating an attribute value
 */
export const updateAttributeValueSchema = z.object({
  body: z.object({
    value: z.string().min(1).optional(),
    colorCode: z.string().optional(),
    displayOrder: z.number().int().optional(),
  }),
});

/**
 * Validation schema for generating Cartesian product combinations
 * Used by the UI "Generate" button when selecting attributes and their values
 */
export const generateCombinationsSchema = z.object({
  body: z.object({
    attributes: z
      .array(
        z.object({
          attributeId: z.number().int().positive("attributeId must be positive integer"),
          valueIds: z.array(z.number().int().positive()).min(1, "At least one valueId is required per attribute"),
        })
      )
      .min(1, "At least one attribute is required to generate combinations"),
  }),
});
