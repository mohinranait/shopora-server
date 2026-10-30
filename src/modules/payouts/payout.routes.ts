import { Router } from "express";
import { PayoutController } from "./payout.controller.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import { requestPayoutSchema, processPayoutSchema } from "./payout.validation.ts";
import { authGuard } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Seller wallet & withdrawal routes
router.get(
  "/wallet",
  authGuard(USER_ROLES.SELLER),
  PayoutController.getSellerWallet
);

router.post(
  "/request",
  authGuard(USER_ROLES.SELLER),
  validateRequest(requestPayoutSchema),
  PayoutController.requestPayout
);

// Admin payout management
router.get(
  "/admin/all",
  authGuard(USER_ROLES.ADMIN),
  PayoutController.adminGetAllPayouts
);

router.patch(
  "/admin/:id/process",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(processPayoutSchema),
  PayoutController.adminProcessPayout
);

export const PayoutRoutes = router;
