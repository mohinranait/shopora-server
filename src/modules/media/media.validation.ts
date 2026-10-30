import { z } from "zod";

/**
 * Validation schema for creating a UseMedia record from an existing Media ID
 * when a user selects an image from their library and supplies alt / description
 */
export const createUseMediaSchema = z.object({
  body: z.object({
    mediaId: z.coerce.number().int().positive("mediaId must be a valid positive integer ID"),
    alt: z.string().trim().optional(),
    description: z.string().trim().optional(),
  }),
});

/**
 * Validation schema for updating a UseMedia record's alt text or description
 */
export const updateUseMediaSchema = z.object({
  body: z.object({
    alt: z.string().trim().optional(),
    description: z.string().trim().optional(),
  }),
});

/**
 * Validation schema for uploading an image directly with alt / description in one request
 */
export const uploadDirectWithMetaSchema = z.object({
  body: z.object({
    alt: z.string().trim().optional(),
    description: z.string().trim().optional(),
    folder: z.string().trim().optional(),
  }),
});
