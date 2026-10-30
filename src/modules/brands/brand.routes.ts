import { Router } from "express";
import { BrandController } from "./brand.controller.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import { createBrandSchema, updateBrandSchema } from "./brand.validation.ts";
import { authGuard } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Public routes
router.get("/", BrandController.getAllBrands);
router.get("/:slug", BrandController.getBrandBySlug);

// Admin-only routes
router.post(
  "/",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(createBrandSchema),
  BrandController.createBrand
);

router.patch(
  "/:id",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(updateBrandSchema),
  BrandController.updateBrand
);

router.delete(
  "/:id",
  authGuard(USER_ROLES.ADMIN),
  BrandController.deleteBrand
);

export const BrandRoutes = router;
