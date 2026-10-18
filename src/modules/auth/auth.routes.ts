import { Router } from "express";
import { AuthController } from "./auth.controller.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import {
  registerCustomerSchema,
  registerSellerSchema,
  loginSchema,
  changePasswordSchema,
  refreshTokenSchema,
} from "./auth.validation.ts";
import { authGuard } from "../../middlewares/auth.ts";

const router = Router();

// Public routes
router.post(
  "/register/customer",
  validateRequest(registerCustomerSchema),
  AuthController.registerCustomer
);

router.post(
  "/register/seller",
  validateRequest(registerSellerSchema),
  AuthController.registerSeller
);

router.post("/login", validateRequest(loginSchema), AuthController.login);

router.post(
  "/refresh-token",
  validateRequest(refreshTokenSchema),
  AuthController.refreshToken
);

// Protected routes
router.get("/me", authGuard(), AuthController.getMe);

router.post(
  "/change-password",
  authGuard(),
  validateRequest(changePasswordSchema),
  AuthController.changePassword
);

export const AuthRoutes = router;
