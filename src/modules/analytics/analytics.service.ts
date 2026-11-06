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

  const prodUseMediaIds = [...new Set(topProducts.map((p: any) => p.mainImageId ?? p.mainImageUseMediaId).filter((id): id is string => typeof id === "string" && Boolean(id)))];
  const useMedias = prodUseMediaIds.length > 0 ? await db.orm.public.UseMedia.where((um) => um.id.in(prodUseMediaIds)).all() : [];
  const rawMediaIds = [...new Set(useMedias.map((um) => um.mediaId))];
  const medias = rawMediaIds.length > 0 ? await db.orm.public.Media.where((m) => m.id.in(rawMediaIds)).all() : [];
  const mediaMap = new Map(medias.map((m) => [m.id, m.url]));
  const useMediaMap = new Map(useMedias.map((um) => [um.id, mediaMap.get(um.mediaId) ?? ""]));

  // 5. Recent 6 Orders
  const recentOrders = await db.orm.public.Order
    .orderBy((o) => o.createdAt.desc())
    .limit(6)
    .all();

  // 6. Active Stock Investment & Net Profit Calculations
  const allProducts = await db.orm.public.Product.all();
  const allVariants = await db.orm.public.ProductVariant.all();
  const variantMapByProduct = new Map<string, any[]>();
  for (const v of allVariants) {
    const list = variantMapByProduct.get(v.productId) || [];
    list.push(v);
    variantMapByProduct.set(v.productId, list);
  }

  let platformInventoryInvestment = 0;
  let totalCatalogInvestment = 0;

  for (const p of allProducts) {
    const pVars = variantMapByProduct.get(p.id) || [];
    let pInvest = 0;
    if (p.productType === "VARIABLE" && pVars.length > 0) {
      for (const v of pVars) {
        const vCost = typeof v.costPrice === "number" ? v.costPrice : (typeof p.costPrice === "number" ? p.costPrice : 0);
        pInvest += (v.stock || 0) * vCost;
      }
    } else {
      const pCost = typeof p.costPrice === "number" ? p.costPrice : 0;
      pInvest += (p.stock || 0) * pCost;
    }

    totalCatalogInvestment += pInvest;
    if (p.isPlatformOwned || !p.sellerId) {
      platformInventoryInvestment += pInvest;
    }
  }

  // Calculate Net Profit from delivered order items
  const deliveredSubOrders = await db.orm.public.SubOrder
    .where({ status: ORDER_STATUS.DELIVERED })
    .all();
  const deliveredSubOrderIds = new Set(deliveredSubOrders.map((so) => so.id));

  const allOrderItems = await db.orm.public.OrderItem.all();
  let directSalesRevenue = 0;
  let directSalesCost = 0;
  let directSalesProfit = 0;

  for (const it of allOrderItems) {
    if (it.subOrderId && deliveredSubOrderIds.has(it.subOrderId)) {
      if (!it.sellerId) {
        // Platform-owned direct item
        const itemRevenue = (it.price || 0) * (it.quantity || 1);
        const itemCost = (it.costPrice || 0) * (it.quantity || 1);
        directSalesRevenue += itemRevenue;
        directSalesCost += itemCost;
        directSalesProfit += (itemRevenue - itemCost);
      }
    }
  }

  const platformCommissionTotal = commissionAgg.total ?? 0;
  const grossSalesTotal = revenueAgg.total ?? 0;
  const netPlatformProfit = directSalesProfit + platformCommissionTotal;
  const profitMarginPercent = grossSalesTotal > 0 ? (netPlatformProfit / grossSalesTotal) * 100 : 0;

  return {
    revenue: {
      grossSales: grossSalesTotal,
      platformCommission: platformCommissionTotal,
      directSalesProfit,
      directSalesRevenue,
      directSalesCost,
      netPlatformProfit,
      profitMarginPercent: Math.round(profitMarginPercent * 10) / 10,
      activeStockInvestment: platformInventoryInvestment,
      totalCatalogInvestment,
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
    topSellingProducts: topProducts.map((p: any) => {
      const mId = p.mainImageId ?? p.mainImageUseMediaId;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        mainImageId: mId ?? null,
        mainImageUseMediaId: mId ?? null,
        mainImage: (mId ? useMediaMap.get(mId) : null) ?? "",
        basePrice: p.basePrice,
        totalSold: p.totalSold,
        stock: p.stock,
        isPlatformOwned: p.isPlatformOwned,
      };
    }),
    recentOrders,
  };
};

export const AnalyticsService = {
  getAdminPlatformAnalytics,
};
