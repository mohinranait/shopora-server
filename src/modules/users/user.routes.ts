import { Router } from "express";
import { UserController } from "./user.controller.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import { updateProfileSchema, addAddressSchema } from "./user.validation.ts";
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

// Admin user management
router.get(
  "/admin/all",
  authGuard(USER_ROLES.ADMIN),
  UserController.adminGetAllUsers
);

router.patch(
  "/admin/:id/status",
  authGuard(USER_ROLES.ADMIN),
  UserController.adminToggleUserStatus
);

export const UserRoutes = router;
