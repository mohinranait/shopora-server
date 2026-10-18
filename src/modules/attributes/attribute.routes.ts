import { Router } from "express";
import { AttributeController } from "./attribute.controller.ts";
import { validateRequest } from "../../middlewares/validate.ts";
import {
  createAttributeSchema,
  updateAttributeSchema,
  createAttributeValueSchema,
  updateAttributeValueSchema,
  generateCombinationsSchema,
} from "./attribute.validation.ts";
import { authGuard } from "../../middlewares/auth.ts";
import { USER_ROLES } from "../../constants/index.ts";

const router = Router();

// ==========================================
// 1. PUBLIC ATTRIBUTES CATALOG
// ==========================================

router.get("/", AttributeController.getAllAttributes);
router.get("/:id", AttributeController.getAttributeById);

// ==========================================
// 2. VARIANT COMBINATIONS GENERATOR (UI "GENERATE" BUTTON)
// ==========================================

router.post(
  "/generate-combinations",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER),
  validateRequest(generateCombinationsSchema),
  AttributeController.generateCombinations
);

// ==========================================
// 3. ATTRIBUTE MANAGEMENT (ADMIN / SELLER)
// ==========================================

router.post(
  "/",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER),
  validateRequest(createAttributeSchema),
  AttributeController.createAttribute
);

router.patch(
  "/:id",
  authGuard(USER_ROLES.ADMIN),
  validateRequest(updateAttributeSchema),
  AttributeController.updateAttribute
);

router.delete(
  "/:id",
  authGuard(USER_ROLES.ADMIN),
  AttributeController.deleteAttribute
);

// ==========================================
// 4. ATTRIBUTE VALUES MANAGEMENT
// ==========================================

router.post(
  "/:id/values",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER),
  validateRequest(createAttributeValueSchema),
  AttributeController.createAttributeValue
);

router.patch(
  "/values/:valueId",
  authGuard(USER_ROLES.ADMIN, USER_ROLES.SELLER),
  validateRequest(updateAttributeValueSchema),
  AttributeController.updateAttributeValue
);

router.delete(
  "/values/:valueId",
  authGuard(USER_ROLES.ADMIN),
  AttributeController.deleteAttributeValue
);

export const AttributeRoutes = router;
