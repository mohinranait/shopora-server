import { z } from "zod";

export const createReviewSchema = z.object({
  body: z.object({
    productId: z.string().min(1, "Product ID is required"),
    rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
    title: z.string().optional(),
    comment: z.string().min(3, "Review comment must be at least 3 characters"),
    images: z.array(z.string()).default([]).optional(),
  }),
});
