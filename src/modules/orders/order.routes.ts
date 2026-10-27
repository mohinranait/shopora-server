import { Router } from "express";
import { OrderController } from "./order.controller.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import {
  createOrderSchema,
  quoteOrderSchema,
  adminUpdateOrderStatusSchema,
  cancelOrderSchema,
  updateSubOrderStatusSchema,
  updatePaymentStatusSchema,
} from "./order.validation.ts";
import { authGuard, optionalAuth } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Price quote for cart / checkout summary (public)
router.post("/quote", validateRequest(quoteOrderSchema), OrderController.quoteOrder);

// Checkout route (supports guest or logged-in user)
router.post(
  "/checkout",
  optionalAuth(),
  validateRequest(createOrderSchema),
  OrderController.createOrder
);

// Customer view their own orders
router.get(
  "/my-orders",
  authGuard(USER_ROLES.CUSTOMER, USER_ROLES.SELLER, USER_ROLES.ADMIN),
  OrderController.getCustomerOrders
);

// Get single order details
router.get(
  "/detail/:id",
  optionalAuth(),
  OrderController.getOrderDetails
);

// Customer (or guest with phone) cancels an order before it's packed
router.post(
  "/:id/cancel",
  optionalAuth(),
  validateRequest(cancelOrderSchema),
  OrderController.cancelOrder
);

// Seller SubOrders management
router.get(
  "/seller/my-suborders",
  authGuard(USER_ROLES.SELLER),
  OrderController.getSellerSubOrders
);

router.patch(
  "/seller/suborder/:id/status",
  authGuard(USER_ROLES.SELLER, USER_ROLES.ADMIN),
  validateRequest(updateSubOrderStatusSchema),
  OrderController.updateSubOrderStatus
);

// Admin all orders management
router.get(
  "/admin/all",
  authGuard(USER_ROLES.ADMIN),
  OrderController.adminGetAllOrders
);

router.get(
  "/admin/:id",
  authGuard(USER_ROLES.ADMIN),
  OrderController.getOrderDetails
);

router.patch(
  "/admin/:id/status",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(adminUpdateOrderStatusSchema),
  OrderController.adminUpdateOrderStatus
);

router.patch(
  "/admin/:id/payment",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(updatePaymentStatusSchema),
  OrderController.updatePaymentStatus
);

export const OrderRoutes = router;
