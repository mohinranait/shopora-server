import { z } from "zod";

export const createBrandSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Brand name must be at least 2 characters"),
    logoId: z.string().nullable().optional(),
    useMediaId: z.string().nullable().optional(),
    description: z.string().optional(),
    website: z.string().url().optional().or(z.literal("")),
    isActive: z.boolean().default(true).optional(),
  }),
});

export const updateBrandSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    logoId: z.string().nullable().optional(),
    useMediaId: z.string().nullable().optional(),
    description: z.string().optional(),
    website: z.string().url().optional().or(z.literal("")),
    isActive: z.boolean().optional(),
  }),
});
