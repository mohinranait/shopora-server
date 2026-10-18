import { Router } from "express";
import { SettingsController } from "./settings.controller.ts";
import { authGuard } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Public: Get dynamic website settings
router.get("/", SettingsController.getAllSettings);

// Admin: Update website settings
router.patch(
  "/",
  authGuard(USER_ROLES.ADMIN),
  SettingsController.updateSettings
);

export const SettingsRoutes = router;
