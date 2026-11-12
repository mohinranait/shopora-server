import { db } from "../../config/db.ts";
import { ORDER_STATUS, SELLER_STATUS, PRODUCT_STATUS } from "../../constants/index.ts";
import { firstRow } from "../../utils/rawQuery.ts";
import { toPaisa, toTaka, paisaToTaka } from "../../utils/money.ts";

/**
 * Admin: Platform-wide High-Level Business Metrics
 */
export const getAdminPlatformAnalytics = async () => {
  const count = (q: { aggregate: (fn: (a: any) => any) => Promise<any> }) => q.aggregate((a) => ({ count: a.count() }));

  // 1-4. All headline aggregates run in parallel; inventory and profit maths happen in SQL
  const [
    totalOrdersCount,
    deliveredOrdersCount,
    pendingOrdersCount,
    revenueAgg,
    commissionAgg,
    totalUsers,
    activeSellers,
    pendingSellers,
    totalProducts,
    publishedProducts,
    topProducts,
    recentOrders,
    investment,
    directSales,
  ] = await Promise.all([
    count(db.orm.public.Order),
    count(db.orm.public.Order.where({ orderStatus: ORDER_STATUS.DELIVERED })),
    count(db.orm.public.Order.where({ orderStatus: ORDER_STATUS.PENDING })),
    // Gross Revenue of paid orders
    db.orm.public.Order.where({ paymentStatus: "PAID" }).aggregate((a) => ({ total: a.sum("totalAmount") })),
    // Platform Commission Earned from delivered SubOrders
    db.orm.public.SubOrder.where({ status: ORDER_STATUS.DELIVERED }).aggregate((a) => ({ total: a.sum("commissionAmount") })),
    count(db.orm.public.User),
    count(db.orm.public.SellerProfile.where({ status: SELLER_STATUS.APPROVED })),
    count(db.orm.public.SellerProfile.where({ status: SELLER_STATUS.PENDING })),
    count(db.orm.public.Product),
    count(db.orm.public.Product.where({ status: PRODUCT_STATUS.PUBLISHED })),
    db.orm.public.Product.orderBy((p) => p.totalSold.desc()).limit(5).all(),
    db.orm.public.Order.orderBy((o) => o.createdAt.desc()).limit(6).all(),
    // Stock investment: variable products value each variant's stock (variant cost, falling back to product cost)
    firstRow<{ total: string; platform: string }>(
      db.raw.sql`
        WITH inv AS (
          SELECT p."isPlatformOwned", p."sellerId",
            CASE WHEN p."productType" = 'VARIABLE' AND EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p."id")
              THEN (SELECT SUM(COALESCE(v."stock", 0) * COALESCE(v."costPrice", p."costPrice", 0)) FROM "ProductVariant" v WHERE v."productId" = p."id")
              ELSE COALESCE(p."stock", 0) * COALESCE(p."costPrice", 0)
            END AS invest
          FROM "Product" p
        )
        SELECT COALESCE(SUM(invest), 0)::text AS total,
               COALESCE(SUM(invest) FILTER (WHERE "isPlatformOwned" OR "sellerId" IS NULL), 0)::text AS platform
        FROM inv`
        .returnsRow({ total: "pg/text@1", platform: "pg/text@1" })
        .build()
    ),
    // Platform-owned items in delivered sub-orders
    firstRow<{ revenue: string; cost: string }>(
      db.raw.sql`
        SELECT COALESCE(SUM(COALESCE(oi."price", 0) * COALESCE(NULLIF(oi."quantity", 0), 1)), 0)::text AS revenue,
               COALESCE(SUM(COALESCE(oi."costPrice", 0) * COALESCE(NULLIF(oi."quantity", 0), 1)), 0)::text AS cost
        FROM "OrderItem" oi
        JOIN "SubOrder" so ON so."id" = oi."subOrderId"
        WHERE so."status" = ${ORDER_STATUS.DELIVERED} AND oi."sellerId" IS NULL`
        .returnsRow({ revenue: "pg/text@1", cost: "pg/text@1" })
        .build()
    ),
  ]);

  const prodUseMediaIds = [...new Set(topProducts.map((p: any) => p.mainImageId ?? p.mainImageUseMediaId).filter((id): id is string => typeof id === "string" && Boolean(id)))];
  const useMedias = prodUseMediaIds.length > 0 ? await db.orm.public.UseMedia.where((um) => um.id.in(prodUseMediaIds)).all() : [];
  const rawMediaIds = [...new Set(useMedias.map((um) => um.mediaId))];
  const medias = rawMediaIds.length > 0 ? await db.orm.public.Media.where((m) => m.id.in(rawMediaIds)).all() : [];
  const mediaMap = new Map(medias.map((m) => [m.id, m.url]));
  const useMediaMap = new Map(useMedias.map((um) => [um.id, mediaMap.get(um.mediaId) ?? ""]));

  const platformInventoryInvestment = toTaka(investment?.platform);
  const totalCatalogInvestment = toTaka(investment?.total);
  const directRevenuePaisa = toPaisa(directSales?.revenue);
  const directCostPaisa = toPaisa(directSales?.cost);
  const directSalesRevenue = paisaToTaka(directRevenuePaisa);
  const directSalesCost = paisaToTaka(directCostPaisa);
  const directSalesProfit = paisaToTaka(directRevenuePaisa - directCostPaisa);

  const commissionPaisa = toPaisa(commissionAgg.total);
  const grossSalesPaisa = toPaisa(revenueAgg.total);
  const platformCommissionTotal = paisaToTaka(commissionPaisa);
  const grossSalesTotal = paisaToTaka(grossSalesPaisa);
  const netProfitPaisa = directRevenuePaisa - directCostPaisa + commissionPaisa;
  const netPlatformProfit = paisaToTaka(netProfitPaisa);
  const profitMarginPercent = grossSalesPaisa > 0 ? (netProfitPaisa / grossSalesPaisa) * 100 : 0;

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
