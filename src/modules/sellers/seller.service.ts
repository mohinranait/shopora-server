import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import {
  SELLER_STATUS,
  PRODUCT_APPROVAL_STATUS,
  PRODUCT_STATUS,
  ORDER_STATUS,
} from "../../constants/index.ts";
import { slugify } from "../../utils/slugify.ts";
import type { IUseMediaWithMedia, IMediaRecord } from "../brands/brand.interface.ts";
import type {
  IPublicStoreFilters,
  IUpdateSellerProfilePayload,
  ISellerDashboardOverview,
} from "./seller.interface.ts";

export type { IPublicStoreFilters };

/**
 * Get public store front of a seller by slug
 */
export const getStoreBySlug = async (storeSlug: string) => {
  const seller: any = await db.orm.public.SellerProfile
    .where({ storeSlug })
    .include("logo", (u) => u.include("media"))
    .include("banner", (u) => u.include("media"))
    .first();
  if (!seller) {
    throw new AppError("Seller store not found", 404);
  }

  if (seller.status !== SELLER_STATUS.APPROVED) {
    throw new AppError("This store is currently unavailable", 404);
  }

  // Fetch approved & published products from this seller
  const products = await db.orm.public.Product
    .where({ sellerId: seller.id })
    .where({ approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED })
    .where({ status: PRODUCT_STATUS.PUBLISHED })
    .orderBy((p) => p.createdAt.desc())
    .all();

  return {
    store: {
      id: seller.id,
      storeName: seller.storeName,
      storeSlug: seller.storeSlug,
      storeLogo: seller.logo?.media?.url ?? null,
      logoUseMedia: seller.logo ?? null,
      storeBanner: seller.banner?.media?.url ?? null,
      bannerUseMedia: seller.banner ?? null,
      storeDescription: seller.storeDescription,
      phone: seller.phone,
      businessAddress: seller.businessAddress,
      isVerified: seller.isVerified,
      createdAt: seller.createdAt,
    },
    products,
  };
};

/**
 * Aggregate public product stats per seller (count, units sold, rating)
 */
const getStoreStats = async (sellerIds: string[]) => {
  if (sellerIds.length === 0) return new Map<string, { productCount: number; totalSold: number; reviewCount: number; rating: number }>();
  const groups = await db.orm.public.Product
    .where({ approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED })
    .where({ status: PRODUCT_STATUS.PUBLISHED })
    .where((p) => p.sellerId.in(sellerIds))
    .groupBy("sellerId")
    .aggregate((a) => ({
      count: a.count(),
      sold: a.sum("totalSold"),
      reviews: a.sum("ratingCount"),
      rating: a.avg("ratingAverage"),
    }));
  return new Map(
    groups.map((g) => [
      g.sellerId as string,
      {
        productCount: Number(g.count) || 0,
        totalSold: Number(g.sold) || 0,
        reviewCount: Number(g.reviews) || 0,
        rating: Math.round((Number(g.rating) || 0) * 10) / 10,
      },
    ])
  );
};

/**
 * Public directory of approved vendor stores with live stats
 */
export const getPublicStores = async (filters: IPublicStoreFilters) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(60, Number(filters.limit) || 24));

  let query = db.orm.public.SellerProfile.where({ status: SELLER_STATUS.APPROVED });
  if (filters.verifiedOnly) {
    query = query.where({ isVerified: true });
  }
  if (filters.search?.trim()) {
    const pattern = `%${filters.search.trim()}%`;
    query = query.where((s, { fns }) =>
      fns.or(s.storeName.ilike(pattern), s.storeDescription.ilike(pattern), s.businessAddress.ilike(pattern))
    );
  }

  // Store counts are small, so stats-based sorting happens in memory after one stats query
  const sellers: any[] = await query
    .include("logo", (u) => u.include("media"))
    .include("banner", (u) => u.include("media"))
    .all();

  const stats = await getStoreStats(sellers.map((s) => s.id));

  const stores = sellers.map((s) => ({
    id: s.id,
    storeName: s.storeName,
    storeSlug: s.storeSlug,
    logoId: s.logoId ?? null,
    bannerId: s.bannerId ?? null,
    logo: s.logo ?? null,
    banner: s.banner ?? null,
    storeLogo: s.logo?.media?.url ?? null,
    storeBanner: s.banner?.media?.url ?? null,
    storeDescription: s.storeDescription ?? null,
    businessAddress: s.businessAddress ?? null,
    isVerified: Boolean(s.isVerified),
    createdAt: s.createdAt,
    productCount: stats.get(s.id)?.productCount ?? 0,
    totalSold: stats.get(s.id)?.totalSold ?? 0,
    reviewCount: stats.get(s.id)?.reviewCount ?? 0,
    rating: stats.get(s.id)?.rating ?? 0,
  }));
  const sortBy = filters.sortBy ?? "popular";
  stores.sort((a, b) => {
    switch (sortBy) {
      case "rating":
        return b.rating - a.rating || b.reviewCount - a.reviewCount;
      case "products":
        return b.productCount - a.productCount;
      case "newest":
        return String(b.createdAt).localeCompare(String(a.createdAt));
      case "name":
        return a.storeName.localeCompare(b.storeName);
      default:
        return b.totalSold - a.totalSold || b.productCount - a.productCount;
    }
  });

  const total = stores.length;
  return {
    stores: stores.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Public profile + stats of a single approved store (products are fetched
 * separately via /products?sellerId=... so they can be filtered and paginated)
 */
export const getPublicStoreBySlug = async (storeSlug: string) => {
  const seller: any = await db.orm.public.SellerProfile
    .where({ storeSlug })
    .include("logo", (u) => u.include("media"))
    .include("banner", (u) => u.include("media"))
    .first();

  if (!seller || seller.status !== SELLER_STATUS.APPROVED) {
    throw new AppError("Seller store not found", 404);
  }

  const stats = await getStoreStats([seller.id]);
  const sStats = stats.get(seller.id);

  return {
    id: seller.id,
    storeName: seller.storeName,
    storeSlug: seller.storeSlug,
    logoId: seller.logoId ?? null,
    bannerId: seller.bannerId ?? null,
    storeLogo: seller.logo?.media?.url ?? null,
    storeBanner: seller.banner?.media?.url ?? null,
    storeDescription: seller.storeDescription ?? null,
    businessAddress: seller.businessAddress ?? null,
    isVerified: Boolean(seller.isVerified),
    createdAt: seller.createdAt,
    productCount: sStats?.productCount ?? 0,
    totalSold: sStats?.totalSold ?? 0,
    reviewCount: sStats?.reviewCount ?? 0,
    rating: sStats?.rating ?? 0,
  };
};

/**
 * Get seller's own dashboard stats & overview
 */
export const getSellerDashboardStats = async (userId: string) => {
  const seller = await db.orm.public.SellerProfile.where({ userId }).first();
  if (!seller) {
    throw new AppError("Seller profile not found", 404);
  }

  // Wallet
  const wallet = await db.orm.public.SellerWallet.where({ sellerId: seller.id }).first();

  // Product Counts
  const totalProducts = await db.orm.public.Product
    .where({ sellerId: seller.id })
    .aggregate((a) => ({ count: a.count() }));

  const approvedProducts = await db.orm.public.Product
    .where({ sellerId: seller.id })
    .where({ approvalStatus: PRODUCT_APPROVAL_STATUS.APPROVED })
    .aggregate((a) => ({ count: a.count() }));

  const pendingProducts = await db.orm.public.Product
    .where({ sellerId: seller.id })
    .where({ approvalStatus: PRODUCT_APPROVAL_STATUS.PENDING })
    .aggregate((a) => ({ count: a.count() }));

  // SubOrders counts
  const totalOrders = await db.orm.public.SubOrder
    .where({ sellerId: seller.id })
    .aggregate((a) => ({ count: a.count() }));

  const pendingOrders = await db.orm.public.SubOrder
    .where({ sellerId: seller.id })
    .where({ status: "PENDING" })
    .aggregate((a) => ({ count: a.count() }));

  // Recent 5 SubOrders
  const recentOrders = await db.orm.public.SubOrder
    .where({ sellerId: seller.id })
    .orderBy((o) => o.createdAt.desc())
    .limit(5)
    .all();

  // Active Stock Investment for this seller
  const sellerProducts = await db.orm.public.Product.where({ sellerId: seller.id }).all();
  const sellerProductIds = sellerProducts.map((p) => p.id);
  const sellerVariants = sellerProductIds.length > 0
    ? await db.orm.public.ProductVariant.where((v) => v.productId.in(sellerProductIds)).all()
    : [];
  const variantMapByProduct = new Map<string, any[]>();
  for (const v of sellerVariants) {
    const list = variantMapByProduct.get(v.productId) || [];
    list.push(v);
    variantMapByProduct.set(v.productId, list);
  }

  let activeStockInvestment = 0;
  for (const p of sellerProducts) {
    const pVars = variantMapByProduct.get(p.id) || [];
    if (p.productType === "VARIABLE" && pVars.length > 0) {
      for (const v of pVars) {
        const vCost = typeof v.costPrice === "number" ? v.costPrice : (typeof p.costPrice === "number" ? p.costPrice : 0);
        activeStockInvestment += (v.stock || 0) * vCost;
      }
    } else {
      const pCost = typeof p.costPrice === "number" ? p.costPrice : 0;
      activeStockInvestment += (p.stock || 0) * pCost;
    }
  }

  // Delivered SubOrders performance
  const deliveredSubOrders = await db.orm.public.SubOrder
    .where({ sellerId: seller.id })
    .where({ status: ORDER_STATUS.DELIVERED })
    .all();
  const deliveredSubOrderIds = new Set(deliveredSubOrders.map((so) => so.id));

  // OrderItems for this seller in delivered orders
  const sellerDeliveredItems = deliveredSubOrderIds.size > 0
    ? await db.orm.public.OrderItem.where({ sellerId: seller.id }).all()
    : [];

  let sellerGrossSales = 0;
  let sellerCostOfGoods = 0;
  for (const it of sellerDeliveredItems) {
    if (it.subOrderId && deliveredSubOrderIds.has(it.subOrderId)) {
      sellerGrossSales += (it.price || 0) * (it.quantity || 1);
      sellerCostOfGoods += (it.costPrice || 0) * (it.quantity || 1);
    }
  }

  const sellerNetEarnings = wallet?.totalEarnings ?? 0;
  // Net Profit for Seller = (Seller Earnings after platform commission) - Cost of Goods Sold
  const netProfit = Math.max(0, sellerNetEarnings - sellerCostOfGoods);
  const profitMarginPercent = sellerGrossSales > 0 ? (netProfit / sellerGrossSales) * 100 : 0;

  return {
    profile: seller,
    wallet,
    metrics: {
      totalProducts: totalProducts.count,
      approvedProducts: approvedProducts.count,
      pendingProducts: pendingProducts.count,
      totalOrders: totalOrders.count,
      pendingOrders: pendingOrders.count,
      availableBalance: wallet?.balance ?? 0,
      pendingBalance: wallet?.pendingBalance ?? 0,
      totalEarnings: wallet?.totalEarnings ?? 0,
      totalCommissionPaid: wallet?.totalCommissionPaid ?? 0,
      activeStockInvestment,
      grossSales: sellerGrossSales,
      costOfGoodsSold: sellerCostOfGoods,
      netProfit,
      profitMarginPercent: Math.round(profitMarginPercent * 10) / 10,
    },
    recentOrders,
  };
};

/**
 * Seller update their own store profile
 */
export const updateSellerProfile = async (
  userId: string,
  payload: IUpdateSellerProfilePayload
) => {
  const seller = await db.orm.public.SellerProfile.where({ userId }).first();
  if (!seller) {
    throw new AppError("Seller profile not found", 404);
  }

  const updateData: any = {};
  if (payload.storeName && payload.storeName !== seller.storeName) {
    updateData.storeName = payload.storeName;
    updateData.storeSlug = slugify(payload.storeName);
  }
  if (payload.logoId !== undefined || payload.logoUseMediaId !== undefined) {
    updateData.logoId = payload.logoId !== undefined ? payload.logoId : payload.logoUseMediaId;
  }
  if (payload.bannerId !== undefined || payload.bannerUseMediaId !== undefined) {
    updateData.bannerId = payload.bannerId !== undefined ? payload.bannerId : payload.bannerUseMediaId;
  }
  if (payload.storeDescription !== undefined) updateData.storeDescription = payload.storeDescription;
  if (payload.phone !== undefined) updateData.phone = payload.phone;
  if (payload.businessAddress !== undefined) updateData.businessAddress = payload.businessAddress;
  if (payload.bankName !== undefined) updateData.bankName = payload.bankName;
  if (payload.bankAccountNumber !== undefined) updateData.bankAccountNumber = payload.bankAccountNumber;
  if (payload.bankRouting !== undefined) updateData.bankRouting = payload.bankRouting;
  if (payload.bkashOrNagad !== undefined) updateData.bkashOrNagad = payload.bkashOrNagad;
  if (payload.isHolidayMode !== undefined) updateData.isHolidayMode = Boolean(payload.isHolidayMode);
  if (payload.holidayMessage !== undefined) updateData.holidayMessage = payload.holidayMessage || null;

  return await db.orm.public.SellerProfile.where({ id: seller.id }).update(updateData);
};

/**
 * Admin: Get all sellers with optional status filter
 */
export const adminGetAllSellers = async (status?: string) => {
  let query = db.orm.public.SellerProfile;
  if (status) {
    query = query.where({ status });
  }

  const sellers: any[] = await query
    .orderBy((s) => s.createdAt.desc())
    .include("user")
    .include("wallet")
    .include("logo", (u) => u.include("media"))
    .include("banner", (u) => u.include("media"))
    .all();

  const sellerIds = sellers.map((s) => s.id);
  const productCountGroups = sellerIds.length
    ? await db.orm.public.Product
        .where((p) => p.sellerId.in(sellerIds))
        .groupBy("sellerId")
        .aggregate((a) => ({ count: a.count() }))
    : [];

  const countMap = new Map<string, number>(
    productCountGroups.map((g) => [g.sellerId as string, Number(g.count) || 0])
  );

  return sellers.map((seller) => ({
    ...seller,
    userEmail: seller.user?.email || null,
    userName: seller.user?.name || null,
    userPhone: seller.user?.phone || null,
    walletBalance: seller.wallet?.currentBalance ?? 0,
    wallet: seller.wallet ?? null,
    productCount: countMap.get(seller.id) ?? 0,
    storeLogo: seller.logo?.media?.url ?? null,
    storeBanner: seller.banner?.media?.url ?? null,
    logoUseMedia: seller.logo ?? null,
    bannerUseMedia: seller.banner ?? null,
  }));
};

/**
 * Admin: Review seller application (Approve, Reject, Suspend, Commission Rate)
 */
export const adminReviewSellerApplication = async (
  sellerId: string,
  payload: {
    status: string;
    rejectionReason?: string;
    commissionRate?: number;
    isVerified?: boolean;
  }
) => {
  const seller = await db.orm.public.SellerProfile.where({ id: sellerId }).first();
  if (!seller) {
    throw new AppError("Seller not found", 404);
  }

  const updateData: any = {
    status: payload.status,
    rejectionReason: payload.status === SELLER_STATUS.REJECTED ? payload.rejectionReason ?? "Application rejected by admin" : null,
  };

  if (payload.commissionRate !== undefined) {
    updateData.commissionRate = payload.commissionRate;
  }

  if (payload.isVerified !== undefined) {
    updateData.isVerified = payload.isVerified;
    if (payload.isVerified) {
      updateData.verifiedAt = new Date().toISOString();
    }
  }

  const updatedSeller = await db.orm.public.SellerProfile
    .where({ id: sellerId })
    .update(updateData);

  // Send in-app notification to the seller
  await db.orm.public.Notification.create({
    userId: seller.userId,
    title: `Seller Account Status: ${payload.status}`,
    message:
      payload.status === SELLER_STATUS.APPROVED
        ? `Congratulations! Your seller application for "${seller.storeName}" has been approved. You can now add and sell products on Shopora!`
        : `Your seller application was ${payload.status.toLowerCase()}. ${payload.rejectionReason || ""}`,
    type: "SYSTEM",
    link: "/seller/notifications",
  });

  return updatedSeller;
};

/**
 * Admin: Get comprehensive Seller Details, Financials, Performance, and Health/Risk Score
 */
export const adminGetSellerDetails = async (sellerId: string) => {
  const seller = await db.orm.public.SellerProfile.where({ id: sellerId }).first();
  if (!seller) {
    throw new AppError("Seller not found", 404);
  }

  // 1. Owner info
  const owner = await db.orm.public.User.where({ id: seller.userId }).first();

  // 2. Wallet & Payout info
  const wallet = await db.orm.public.SellerWallet.where({ sellerId: seller.id }).first();
  const payouts = await db.orm.public.PayoutRequest
    .where({ sellerId: seller.id })
    .orderBy((p) => p.createdAt.desc())
    .limit(10)
    .all();

  // 3. Products Stats & Recent Products
  const products = await db.orm.public.Product
    .where({ sellerId: seller.id })
    .orderBy((p) => p.createdAt.desc())
    .all();

  const totalProducts = products.length;
  const approvedProducts = products.filter((p) => p.approvalStatus === "APPROVED").length;
  const pendingProducts = products.filter((p) => p.approvalStatus === "PENDING").length;
  const rejectedProducts = products.filter((p) => p.approvalStatus === "REJECTED").length;
  const outOfStockProducts = products.filter((p) => p.stock <= 0).length;

  // Average Rating
  const ratedProducts = products.filter((p) => p.ratingAverage && p.ratingAverage > 0);
  const avgRating = ratedProducts.length > 0
    ? ratedProducts.reduce((sum, p) => sum + (p.ratingAverage || 0), 0) / ratedProducts.length
    : 0;
  const totalReviews = products.reduce((sum, p) => sum + (p.ratingCount || 0), 0);

  // 4. SubOrders (Sales Performance)
  const subOrders = await db.orm.public.SubOrder
    .where({ sellerId: seller.id })
    .orderBy((s) => s.createdAt.desc())
    .all();

  const totalOrders = subOrders.length;
  const deliveredOrders = subOrders.filter((s) => s.status === "DELIVERED").length;
  const processingOrders = subOrders.filter((s) => ["PROCESSING", "SHIPPED", "CONFIRMED"].includes(s.status)).length;
  const cancelledOrders = subOrders.filter((s) => s.status === "CANCELLED").length;
  const returnedOrders = subOrders.filter((s) => s.status === "RETURNED").length;

  const grossSales = subOrders.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const netEarnings = subOrders.reduce((sum, s) => sum + (s.sellerEarnings || 0), 0);
  const platformCommission = subOrders.reduce((sum, s) => sum + (s.commissionAmount || 0), 0);

  const fulfillmentRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 100;
  const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
  const returnRate = totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0;

  // 5. Calculate Health Score (0 - 100) & Reputation
  let healthScore = 70; // baseline
  if (seller.isVerified) healthScore += 10;
  if (seller.status === "APPROVED") healthScore += 10;
  else if (seller.status === "SUSPENDED") healthScore -= 40;
  else if (seller.status === "REJECTED") healthScore -= 50;

  if (avgRating >= 4.5) healthScore += 10;
  else if (avgRating >= 3.5) healthScore += 5;
  else if (avgRating > 0 && avgRating < 3.0) healthScore -= 15;

  if (cancellationRate > 20) healthScore -= 20;
  else if (cancellationRate > 10) healthScore -= 10;

  if (returnRate > 15) healthScore -= 15;

  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  let reputation: "EXCELLENT" | "GOOD" | "AVERAGE" | "RISKY" | "CRITICAL" = "GOOD";
  if (healthScore >= 85) reputation = "EXCELLENT";
  else if (healthScore >= 70) reputation = "GOOD";
  else if (healthScore >= 50) reputation = "AVERAGE";
  else if (healthScore >= 30) reputation = "RISKY";
  else reputation = "CRITICAL";

  // Risk & Health Flags
  const riskFlags: string[] = [];
  if (seller.status === "SUSPENDED") riskFlags.push("Store is currently SUSPENDED by administration");
  if (!seller.isVerified) riskFlags.push("KYC verification is incomplete or unverified");
  if (cancellationRate > 15) riskFlags.push(`High cancellation rate detected (${cancellationRate.toFixed(1)}%)`);
  if (returnRate > 10) riskFlags.push(`High product return rate (${returnRate.toFixed(1)}%)`);
  if (avgRating > 0 && avgRating < 3.5) riskFlags.push(`Low customer satisfaction rating (${avgRating.toFixed(1)}/5.0)`);
  if (outOfStockProducts > 0 && outOfStockProducts >= totalProducts / 2 && totalProducts > 0) {
    riskFlags.push(`${outOfStockProducts} out of ${totalProducts} products are out of stock`);
  }

  // 6. Recent SubOrders with Order & Buyer info
  const recentOrders = await Promise.all(
    subOrders.slice(0, 10).map(async (so) => {
      const order = await db.orm.public.Order.where({ id: so.orderId }).first();
      return {
        id: so.id,
        subOrderNumber: so.subOrderNumber,
        orderId: so.orderId,
        orderNumber: order?.orderNumber,
        customerName: order?.shippingAddress ? (order.shippingAddress as any).fullName : "Customer",
        customerPhone: order?.shippingAddress ? (order.shippingAddress as any).phone : null,
        totalAmount: so.totalAmount,
        sellerEarnings: so.sellerEarnings,
        commissionAmount: so.commissionAmount,
        status: so.status,
        createdAt: so.createdAt,
      };
    })
  );

  return {
    seller,
    owner: owner
      ? {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
          role: owner.role,
          isActive: owner.isActive,
          createdAt: owner.createdAt,
        }
      : null,
    wallet,
    payouts,
    performance: {
      totalProducts,
      approvedProducts,
      pendingProducts,
      rejectedProducts,
      outOfStockProducts,
      avgRating,
      totalReviews,
      totalOrders,
      deliveredOrders,
      processingOrders,
      cancelledOrders,
      returnedOrders,
      fulfillmentRate: Math.round(fulfillmentRate),
      cancellationRate: Math.round(cancellationRate),
      returnRate: Math.round(returnRate),
      grossSales,
      netEarnings,
      platformCommission,
      healthScore,
      reputation,
      riskFlags,
    },
    recentProducts: await (async () => {
      const recentList = products.slice(0, 8);
      const prodMediaIds = [...new Set(recentList.map((p: any) => p.mainImageId ?? p.mainImageUseMediaId).filter((id): id is string => typeof id === "string" && Boolean(id)))];
      const prodUseMedias = prodMediaIds.length > 0 ? await db.orm.public.UseMedia.where((um) => um.id.in(prodMediaIds)).all() : [];
      const rawMedIds = [...new Set(prodUseMedias.map((um) => um.mediaId))];
      const rawMeds = rawMedIds.length > 0 ? await db.orm.public.Media.where((m) => m.id.in(rawMedIds)).all() : [];
      const rawMedMap = new Map(rawMeds.map((m) => [m.id, m.url]));
      const useMediaUrlMap = new Map(prodUseMedias.map((um) => [um.id, rawMedMap.get(um.mediaId) ?? ""]));

      return recentList.map((p: any) => {
        const mId = p.mainImageId ?? p.mainImageUseMediaId;
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          mainImageId: mId ?? null,
          mainImage: (mId ? useMediaUrlMap.get(mId) : null) ?? null,
          basePrice: p.basePrice,
          stock: p.stock,
          status: p.status,
          approvalStatus: p.approvalStatus,
          ratingAverage: p.ratingAverage,
          createdAt: p.createdAt,
        };
      });
    })(),
    recentOrders,
  };
};

/**
 * Admin: Send direct warning or system notice to seller
 */
export const adminSendSellerNotice = async (sellerId: string, title: string, message: string) => {
  const seller = await db.orm.public.SellerProfile.where({ id: sellerId }).first();
  if (!seller) throw new AppError("Seller not found", 404);

  await db.orm.public.Notification.create({
    userId: seller.userId,
    title,
    message,
    type: "SYSTEM",
    link: "/seller/notifications",
  });

  return { message: "Notice sent to seller successfully" };
};


export const SellerService = {
  getPublicStores,
  getPublicStoreBySlug,
  getStoreBySlug,
  getSellerDashboardStats,
  updateSellerProfile,
  adminGetAllSellers,
  adminGetSellerDetails,
  adminReviewSellerApplication,
  adminSendSellerNotice,
};