import { Router } from "express";
import { authGuard } from "../../middlewares/auth.ts";
import { upload } from "../../middlewares/multer.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import { USER_ROLES } from "../../constants/index.ts";
import { MediaController } from "./media.controller.ts";
import {
  createUseMediaSchema,
  updateUseMediaSchema,
} from "./media.validation.ts";

const router = Router();

// ==========================================
// 1. RAW MEDIA UPLOAD & LIBRARY ENDPOINTS
// ==========================================

/**
 * Upload single image buffer to Cloudinary and record in Media model
 */
router.post(
  "/upload",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.CUSTOMER),
  upload.single("image"),
  MediaController.uploadSingleMedia
);

/**
 * Upload multiple images (up to 10) concurrently to Cloudinary and record in Media model
 */
router.post(
  "/upload-multiple",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER),
  upload.array("images", 10),
  MediaController.uploadMultipleMedia
);

/**
 * Upload single image and automatically create configured UseMedia record in one step
 */
router.post(
  "/upload-and-use",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.CUSTOMER),
  upload.single("image"),
  MediaController.uploadAndUse
);

/**
 * List uploaded media assets in library (supports pagination and folder filtering)
 */
router.get(
  "/",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.CUSTOMER),
  MediaController.getMyMediaLibrary
);

// ==========================================
// 2. USE-MEDIA (CONFIGURED ASSET) ENDPOINTS
// ==========================================

/**
 * Create UseMedia record from selected mediaId with alt and description
 */
router.post(
  "/use-media",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.CUSTOMER),
  validateRequest(createUseMediaSchema),
  MediaController.createUseMedia
);

/**
 * List configured UseMedia items
 */
router.get(
  "/use-media",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.CUSTOMER),
  MediaController.getUseMediaLibrary
);

/**
 * Get single UseMedia configuration by ID
 */
router.get(
  "/use-media/:id",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.CUSTOMER),
  MediaController.getUseMediaById
);

/**
 * Update UseMedia alt or description
 */
router.patch(
  "/use-media/:id",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.CUSTOMER),
  validateRequest(updateUseMediaSchema),
  MediaController.updateUseMedia
);

/**
 * Delete UseMedia record
 */
router.delete(
  "/use-media/:id",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.CUSTOMER),
  MediaController.deleteUseMedia
);

// ==========================================
// 3. RAW MEDIA ASSET DETAIL & DELETION
// ==========================================

/**
 * Get single raw media asset by ID
 */
router.get(
  "/:id",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER, USER_ROLES.CUSTOMER),
  MediaController.getMediaById
);

/**
 * Delete raw media asset from Cloudinary and database
 */
router.delete(
  "/:id",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER),
  MediaController.deleteMedia
);

export const mediaRoutes = router;
