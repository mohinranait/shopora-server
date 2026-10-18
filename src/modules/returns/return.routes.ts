import { Router } from "express";
import { ReturnController } from "./return.controller.ts";
import { authGuard } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Customer routes
router.post("/", authGuard(), ReturnController.createReturnRequest);
router.get("/my-returns", authGuard(), ReturnController.getCustomerReturns);

// Admin routes
router.get(
  "/admin/all",
  authGuard(USER_ROLES.ADMIN),
  ReturnController.adminGetAllReturns
);

router.patch(
  "/admin/:id/review",
  authGuard(USER_ROLES.ADMIN),
  ReturnController.adminReviewReturn
);

export const ReturnRoutes = router;
