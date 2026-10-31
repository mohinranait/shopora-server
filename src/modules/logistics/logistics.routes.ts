import { Router } from "express";
import * as LogisticsController from "./logistics.controller.ts";
import { authGuard } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Public: Track any consignment by tracking number
router.get("/track/:trackingCode", LogisticsController.trackParcel);

// Seller or Admin: Book courier for a suborder
router.post(
  "/suborders/:id/book-courier",
  authGuard(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  LogisticsController.bookCourier
);

// Seller or Admin: Get printable thermal packaging slip data
router.get(
  "/suborders/:id/packaging-slip",
  authGuard(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  LogisticsController.getPackagingSlip
);

export const LogisticsRoutes = router;
