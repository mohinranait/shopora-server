import { db } from "../../config/db.ts";
import { ORDER_STATUS, SELLER_STATUS, PRODUCT_STATUS } from "../../constants/index.ts";

/**
 * Admin: Platform-wide High-Level Business Metrics
 */
export const getAdminPlatformAnalytics = async () => {
  // 1. Order and Revenue Aggregates
  const totalOrdersCount = await db.orm.public.Order.aggregate((a) => ({ count: a.count() }));
  const deliveredOrdersCount = await db.orm.public.Order
    .where({ orderStatus: ORDER_STATUS.DELIVERED })
    .aggregate((a) => ({ count: a.count() }));

  const pendingOrdersCount = await db.orm.public.Order
    .where({ orderStatus: ORDER_STATUS.PENDING })
    .aggregate((a) => ({ count: a.count() }));

  // Gross Revenue of delivered/paid orders
  const revenueAgg = await db.orm.public.Order
    .where({ paymentStatus: "PAID" })
    .aggregate((a) => ({ total: a.sum("totalAmount") }));

  // Platform Commission Earned from delivered SubOrders
  const commissionAgg = await db.orm.public.SubOrder
    .where({ status: ORDER_STATUS.DELIVERED })
    .aggregate((a) => ({ total: a.sum("commissionAmount") }));

  // 2. User & Seller Counts
  const totalUsers = await db.orm.public.User.aggregate((a) => ({ count: a.count() }));
  const activeSellers = await db.orm.public.SellerProfile
    .where({ status: SELLER_STATUS.APPROVED })
    .aggregate((a) => ({ count: a.count() }));

  const pendingSellers = await db.orm.public.SellerProfile
    .where({ status: SELLER_STATUS.PENDING })
    .aggregate((a) => ({ count: a.count() }));

  // 3. Product Counts
  const totalProducts = await db.orm.public.Product.aggregate((a) => ({ count: a.count() }));
  const publishedProducts = await db.orm.public.Product
    .where({ status: PRODUCT_STATUS.PUBLISHED })
    .aggregate((a) => ({ count: a.count() }));

  // 4. Top Selling Products
  const topProducts = await db.orm.public.Product
    .orderBy((p) => p.totalSold.desc())
    .limit(5)
    .all();

  // 5. Recent 6 Orders
  const recentOrders = await db.orm.public.Order
    .orderBy((o) => o.createdAt.desc())
    .limit(6)
    .all();

  return {
    revenue: {
      grossSales: revenueAgg.total ?? 0,
      platformCommission: commissionAgg.total ?? 0,
    },
    orders: {
      total: totalOrdersCount.count,
      delivered: deliveredOrdersCount.count,
      pending: pendingOrdersCount.count,
    },
    users: {
      totalUsers: totalUsers.count,
      activeSellers: activeSellers.count,
      pendingSellers: pendingSellers.count,
    },
    products: {
      total: totalProducts.count,
      published: publishedProducts.count,
    },
    topSellingProducts: topProducts.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      mainImage: p.mainImage,
      basePrice: p.basePrice,
      totalSold: p.totalSold,
      stock: p.stock,
      isPlatformOwned: p.isPlatformOwned,
    })),
    recentOrders,
  };
};

export const AnalyticsService = {
  getAdminPlatformAnalytics,
};
