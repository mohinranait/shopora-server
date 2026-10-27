import { Router } from "express";
import { UserController } from "./user.controller.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import {
  updateProfileSchema,
  addAddressSchema,
  adminUpdateUserSchema,
} from "./user.validation.ts";
import { authGuard } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// Authenticated user profile & address management
router.patch(
  "/profile",
  authGuard(),
  validateRequest(updateProfileSchema),
  UserController.updateProfile
);

router.get("/addresses", authGuard(), UserController.getUserAddresses);

router.post(
  "/addresses",
  authGuard(),
  validateRequest(addAddressSchema),
  UserController.addAddress
);

router.delete("/addresses/:id", authGuard(), UserController.deleteAddress);

// Admin user & customer management
router.get(
  "/admin/all",
  authGuard(USER_ROLES.ADMIN),
  UserController.adminGetAllUsers
);

router.get(
  "/admin/:id",
  authGuard(USER_ROLES.ADMIN),
  UserController.adminGetUserDetail
);

router.patch(
  "/admin/:id",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(adminUpdateUserSchema),
  UserController.adminUpdateUser
);

router.patch(
  "/admin/:id/status",
  authGuard(USER_ROLES.ADMIN),
  UserController.adminToggleUserStatus
);

export const UserRoutes = router;
