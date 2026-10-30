import { z } from "zod";

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, "Category name must be at least 2 characters"),
    description: z.string().optional(),
    imageId: z.string().nullable().optional(),
    useMediaId: z.string().nullable().optional(),
    icon: z.string().optional(),
    parentId: z.string().nullable().optional(),
    displayOrder: z.number().int().default(0).optional(),
    isActive: z.boolean().default(true).optional(),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
    imageId: z.string().nullable().optional(),
    useMediaId: z.string().nullable().optional(),
    icon: z.string().optional(),
    parentId: z.string().nullable().optional(),
    displayOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});
