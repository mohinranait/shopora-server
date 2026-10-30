import { z } from "zod";

export const createSliderSchema = z.object({
  body: z.object({
    type: z.enum(["IMAGE_ONLY", "IMAGE_BG_CONTENT", "CONTENT_ONLY"]).default("IMAGE_BG_CONTENT"),
    title: z.string().optional().nullable(),
    subtitle: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    badgeText: z.string().optional().nullable(),
    useMediaId: z.number().int().positive().nullable().optional(),
    mobileUseMediaId: z.number().int().positive().nullable().optional(),
    linkUrl: z.string().optional().nullable(),
    buttonText: z.string().optional().nullable(),
    bgGradient: z.string().optional().nullable(),
    bgColor: z.string().optional().nullable(),
    textColor: z.enum(["LIGHT", "DARK"]).default("LIGHT").optional(),
    displayOrder: z.number().int().default(0).optional(),
    isActive: z.boolean().default(true).optional(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
  }),
});

export const updateSliderSchema = z.object({
  body: z.object({
    type: z.enum(["IMAGE_ONLY", "IMAGE_BG_CONTENT", "CONTENT_ONLY"]).optional(),
    title: z.string().optional().nullable(),
    subtitle: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    badgeText: z.string().optional().nullable(),
    useMediaId: z.number().int().positive().nullable().optional(),
    mobileUseMediaId: z.number().int().positive().nullable().optional(),
    linkUrl: z.string().optional().nullable(),
    buttonText: z.string().optional().nullable(),
    bgGradient: z.string().optional().nullable(),
    bgColor: z.string().optional().nullable(),
    textColor: z.enum(["LIGHT", "DARK"]).optional(),
    displayOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
  }),
});
