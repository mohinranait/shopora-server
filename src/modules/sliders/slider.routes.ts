import { Router } from "express";
import { SliderController } from "./slider.controller.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import { createSliderSchema, updateSliderSchema } from "./slider.validation.ts";
import { authGuard } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Public routes
router.get("/", SliderController.getSliders);
router.get("/:id", SliderController.getSliderById);

// Admin-only routes
router.post(
  "/",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(createSliderSchema),
  SliderController.createSlider
);

router.patch(
  "/:id",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(updateSliderSchema),
  SliderController.updateSlider
);

router.delete(
  "/:id",
  authGuard(USER_ROLES.ADMIN),
  SliderController.deleteSlider
);

export const SliderRoutes = router;
