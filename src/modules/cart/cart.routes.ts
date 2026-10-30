import { Router } from "express";
import { CartController } from "./cart.controller.ts";
import { optionalAuth } from "../../middlewares/auth.ts";

const router = Router();

router.use(optionalAuth());

router.get("/", CartController.getCart);
router.post("/add", CartController.addToCart);
router.patch("/item/:id", CartController.updateCartItemQuantity);
router.delete("/item/:id", CartController.removeCartItem);
router.delete("/clear", CartController.clearCart);

export const CartRoutes = router;
