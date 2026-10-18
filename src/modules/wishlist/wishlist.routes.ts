import { Router } from "express";
import { WishlistController } from "./wishlist.controller.ts";
import { authGuard } from "../../middlewares/auth.ts";

const router = Router();

router.use(authGuard()); // All wishlist routes require logged in user

router.get("/", WishlistController.getUserWishlist);
router.post("/toggle", WishlistController.toggleWishlist);
router.delete("/:productId", WishlistController.removeWishlistItem);

export const WishlistRoutes = router;
