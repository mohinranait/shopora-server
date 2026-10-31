import { Router } from "express";
import { ProductController } from "./product.controller.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import {
  createProductSchema,
  updateProductSchema,
  reviewProductApprovalSchema,
  productFilterQuerySchema,
} from "./product.validation.ts";
import { authGuard, optionalAuth } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Public routes
router.get(
  "/",
  validateRequest(productFilterQuerySchema),
  ProductController.getAllProducts
);

router.get(
  "/filters",
  validateRequest(productFilterQuerySchema),
  ProductController.getProductFilters
);

router.get("/search/autocomplete", ProductController.getAutocomplete);
router.get("/:id/bundle", ProductController.getBundle);

router.get("/detail/:slug", optionalAuth(), ProductController.getProductBySlug);

// Seller routes
router.get(
  "/seller/my-products",
  authGuard(USER_ROLES.SELLER),
  ProductController.getSellerProducts
);

// Admin routes
router.get(
  "/admin/all",
  authGuard(USER_ROLES.ADMIN),
  ProductController.getAdminProducts
);

router.patch(
  "/admin/:id/approval",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(reviewProductApprovalSchema),
  ProductController.reviewProductApproval
);

// Single Product by ID (Admin, Seller, or Public depending on product status)
router.get("/:id", optionalAuth(), ProductController.getProductById);

// Creation route (Admin or Approved Seller)
router.post(
  "/",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER),
  validateRequest(createProductSchema),
  ProductController.createProduct
);

// Update route (Admin or Product Owner Seller)
router.patch(
  "/:id",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER),
  validateRequest(updateProductSchema),
  ProductController.updateProduct
);

// Delete route
router.delete(
  "/:id",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER),
  ProductController.deleteProduct
);

export const ProductRoutes = router;
