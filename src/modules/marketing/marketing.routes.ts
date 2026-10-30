import { Router } from "express";
import { MarketingController } from "./marketing.controller.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import {
  createCouponSchema,
  validateCouponSchema,
  createBannerSchema,
} from "./marketing.validation.ts";
import { authGuard } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Coupons
router.post(
  "/coupons/validate",
  validateRequest(validateCouponSchema),
  MarketingController.validateCoupon
);

router.get(
  "/coupons/admin/all",
  authGuard(USER_ROLES.ADMIN),
  MarketingController.getAllCoupons
);

router.post(
  "/coupons/admin",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(createCouponSchema),
  MarketingController.createCoupon
);

router.delete(
  "/coupons/admin/:id",
  authGuard(USER_ROLES.ADMIN),
  MarketingController.deleteCoupon
);

// Banners
router.get("/banners", MarketingController.getActiveBanners);

router.get(
  "/banners/admin/all",
  authGuard(USER_ROLES.ADMIN),
  MarketingController.getAllBanners
);

router.post(
  "/banners/admin",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(createBannerSchema),
  MarketingController.createBanner
);

router.delete(
  "/banners/admin/:id",
  authGuard(USER_ROLES.ADMIN),
  MarketingController.deleteBanner
);

export const MarketingRoutes = router;
