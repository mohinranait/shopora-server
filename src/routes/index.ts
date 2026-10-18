import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.routes.ts";
import { UserRoutes } from "../modules/users/user.routes.ts";
import { CategoryRoutes } from "../modules/categories/category.routes.ts";
import { BrandRoutes } from "../modules/brands/brand.routes.ts";
import { ProductRoutes } from "../modules/products/product.routes.ts";
import { SellerRoutes } from "../modules/sellers/seller.routes.ts";
import { OrderRoutes } from "../modules/orders/order.routes.ts";
import { CartRoutes } from "../modules/cart/cart.routes.ts";
import { WishlistRoutes } from "../modules/wishlist/wishlist.routes.ts";
import { ReviewRoutes } from "../modules/reviews/review.routes.ts";
import { MarketingRoutes } from "../modules/marketing/marketing.routes.ts";
import { PayoutRoutes } from "../modules/payouts/payout.routes.ts";
import { SettingsRoutes } from "../modules/settings/settings.routes.ts";
import { AnalyticsRoutes } from "../modules/analytics/analytics.routes.ts";
import { ReturnRoutes } from "../modules/returns/return.routes.ts";
import { mediaRoutes } from "../modules/media/media.routes.ts";
import { AttributeRoutes } from "../modules/attributes/attribute.routes.ts";

const router = Router();

const moduleRoutes = [
  { path: "/auth", route: AuthRoutes },
  { path: "/users", route: UserRoutes },
  { path: "/categories", route: CategoryRoutes },
  { path: "/brands", route: BrandRoutes },
  { path: "/products", route: ProductRoutes },
  { path: "/attributes", route: AttributeRoutes },
  { path: "/sellers", route: SellerRoutes },
  { path: "/orders", route: OrderRoutes },
  { path: "/cart", route: CartRoutes },
  { path: "/wishlist", route: WishlistRoutes },
  { path: "/reviews", route: ReviewRoutes },
  { path: "/marketing", route: MarketingRoutes },
  { path: "/payouts", route: PayoutRoutes },
  { path: "/settings", route: SettingsRoutes },
  { path: "/analytics", route: AnalyticsRoutes },
  { path: "/returns", route: ReturnRoutes },
  { path: "/media", route: mediaRoutes },
];

for (const { path, route } of moduleRoutes) {
  router.use(path, route);
}

export const ApplicationRoutes = router;
