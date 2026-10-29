import { Router } from "express";
import { SellerController } from "./seller.controller.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import {
  updateSellerProfileSchema,
  reviewSellerApplicationSchema,
  sendSellerNoticeSchema,
} from "./seller.validation.ts";
import { authGuard } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Public route to view seller store
router.get("/store/:slug", SellerController.getStoreBySlug);

// Public vendor directory & store profile
router.get("/stores", SellerController.getPublicStores);
router.get("/stores/:slug", SellerController.getPublicStoreBySlug);

// Seller authenticated routes
router.get(
  "/me/dashboard",
  authGuard(USER_ROLES.SELLER),
  SellerController.getSellerDashboardStats
);

router.patch(
  "/me/profile",
  authGuard(USER_ROLES.SELLER),
  validateRequest(updateSellerProfileSchema),
  SellerController.updateSellerProfile
);

// Admin routes
router.get(
  "/admin/all",
  authGuard(USER_ROLES.ADMIN),
  SellerController.adminGetAllSellers
);

router.get(
  "/admin/:id",
  authGuard(USER_ROLES.ADMIN),
  SellerController.adminGetSellerDetails
);

router.patch(
  "/admin/:id/review",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(reviewSellerApplicationSchema),
  SellerController.adminReviewSellerApplication
);

router.post(
  "/admin/:id/notice",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(sendSellerNoticeSchema),
  SellerController.adminSendSellerNotice
);

export const SellerRoutes = router;
