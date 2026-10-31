import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.ts";
import { sendResponse } from "../../utils/sendResponse.ts";
import * as QuestionService from "./question.service.ts";

export const getQuestionsByProduct = catchAsync(async (req: Request, res: Response) => {
  const productId = req.params.productId as string;
  const result = await QuestionService.getQuestionsByProduct(productId);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Product questions retrieved successfully",
    data: result,
  });
});

export const askQuestion = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await QuestionService.askQuestion(userId, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Question submitted successfully",
    data: result,
  });
});

export const answerQuestion = catchAsync(async (req: Request, res: Response) => {
  const questionId = req.params.id as string;
  const result = await QuestionService.answerQuestion(questionId, req.user!, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Answer published successfully",
    data: result,
  });
});

export const deleteQuestion = catchAsync(async (req: Request, res: Response) => {
  const questionId = req.params.id as string;
  await QuestionService.deleteQuestion(questionId, req.user!);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Question deleted successfully",
    data: null,
  });
});
