import { Router } from "express";
import { ReviewController } from "./review.controller.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import { createReviewSchema } from "./review.validation.ts";
import { authGuard } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Public: View product reviews
router.get("/product/:productId", ReviewController.getProductReviews);

// Customer: Add review
router.post(
  "/",
  authGuard(),
  validateRequest(createReviewSchema),
  ReviewController.createReview
);

// Admin: Moderate review
router.patch(
  "/admin/:id/moderate",
  authGuard(USER_ROLES.ADMIN),
  ReviewController.adminModerateReview
);

export const ReviewRoutes = router;
