import { z } from "zod";

export const createBrandSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Brand name must be at least 2 characters"),
    logo: z.string().optional(),
    useMediaId: z.number().int().positive().nullable().optional(),
    description: z.string().optional(),
    website: z.string().url().optional().or(z.literal("")),
    isActive: z.boolean().default(true).optional(),
  }),
});

export const updateBrandSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    logo: z.string().optional(),
    useMediaId: z.number().int().positive().nullable().optional(),
    description: z.string().optional(),
    website: z.string().url().optional().or(z.literal("")),
    isActive: z.boolean().optional(),
  }),
});
