import { Router } from "express";
import { AnalyticsController } from "./analytics.controller.ts";
import { authGuard } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Admin-only platform analytics
router.get(
  "/admin",
  authGuard(USER_ROLES.ADMIN),
  AnalyticsController.getAdminPlatformAnalytics
);

export const AnalyticsRoutes = router;
