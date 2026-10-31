import { Router } from "express";
import * as QuestionController from "./question.controller.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import { askQuestionSchema, answerQuestionSchema } from "./question.validation.ts";
import { authGuard, optionalAuth } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Public: Get all questions and verified answers for a product
router.get("/product/:productId", optionalAuth(), QuestionController.getQuestionsByProduct);

// Authenticated customer: Ask a question
router.post(
  "/",
  authGuard(USER_ROLES.CUSTOMER, USER_ROLES.SELLER, USER_ROLES.ADMIN),
  validateRequest(askQuestionSchema),
  QuestionController.askQuestion
);

// Seller or Admin: Answer a question
router.patch(
  "/:id/answer",
  authGuard(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  validateRequest(answerQuestionSchema),
  QuestionController.answerQuestion
);

// Customer author or Admin: Delete question
router.delete(
  "/:id",
  authGuard(USER_ROLES.CUSTOMER, USER_ROLES.SELLER, USER_ROLES.ADMIN),
  QuestionController.deleteQuestion
);

export const QuestionRoutes = router;
