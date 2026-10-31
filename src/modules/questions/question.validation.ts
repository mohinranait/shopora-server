import { z } from "zod";

export const askQuestionSchema = z.object({
  body: z.object({
    productId: z.string().min(1, "Product ID is required"),
    question: z.string().min(3, "Question must be at least 3 characters long").max(500, "Question is too long"),
  }),
});

export const answerQuestionSchema = z.object({
  body: z.object({
    answer: z.string().min(2, "Answer must be at least 2 characters long").max(1000, "Answer is too long"),
  }),
});
