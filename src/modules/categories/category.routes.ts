import { Router } from "express";
import { CategoryController } from "./category.controller.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import {
  createCategorySchema,
  updateCategorySchema,
} from "./category.validation.ts";
import { authGuard } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Public routes
router.get("/tree", CategoryController.getCategoryTree);
router.get("/", CategoryController.getAllCategories);
router.get("/:slug", CategoryController.getCategoryBySlug);

// Admin-only routes
router.post(
  "/",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(createCategorySchema),
  CategoryController.createCategory
);

router.patch(
  "/:id",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(updateCategorySchema),
  CategoryController.updateCategory
);

router.delete(
  "/:id",
  authGuard(USER_ROLES.ADMIN),
  CategoryController.deleteCategory
);

export const CategoryRoutes = router;
