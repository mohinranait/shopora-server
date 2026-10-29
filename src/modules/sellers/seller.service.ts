import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { SELLER_STATUS, PRODUCT_APPROVAL_STATUS, PRODUCT_STATUS } from "../../constants/index.ts";
import { slugify } from "../../utils/slugify.ts";

/**
 * Get public store front of a seller by slug
 */
export const getStoreBySlug = async (storeSlug: string) => {
  const seller = await db.orm.public.SellerProfile.where({ storeSlug }).first();
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

  let logoUseMedia: any = null;
  if (seller.logoUseMediaId) {
    const um = await db.orm.public.UseMedia.where({ id: seller.logoUseMediaId }).first();
    if (um) {
      const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
      logoUseMedia = { ...um, media: m };
    }
  }

  let bannerUseMedia: any = null;
  if (seller.bannerUseMediaId) {
    const um = await db.orm.public.UseMedia.where({ id: seller.bannerUseMediaId }).first();
    if (um) {
      const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
      bannerUseMedia = { ...um, media: m };
    }
  }

  return {
    store: {
      id: seller.id,
      storeName: seller.storeName,
      storeSlug: seller.storeSlug,
      storeLogo: seller.storeLogo,
      logoUseMedia,
      storeBanner: seller.storeBanner,
      bannerUseMedia,
      storeDescription: seller.storeDescription,
      businessAddress: seller.businessAddress,
      isVerified: seller.isVerified,
      createdAt: seller.createdAt,
    },
    products,
  };
};

export interface IPublicStoreFilters {
  search?: string;
  sortBy?: "popular" | "rating" | "products" | "newest" | "name";
  verifiedOnly?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Resolve logo/banner UseMedia -> Media urls for a batch of sellers in two queries
 */
const resolveStoreMedia = async (sellers: { logoUseMediaId: number | null; bannerUseMediaId: number | null }[]) => {
  const useMediaIds = [
    ...new Set(
      sellers.flatMap((s) => [s.logoUseMediaId, s.bannerUseMediaId]).filter((id): id is number => typeof id === "number")
    ),
  ];
  if (useMediaIds.length === 0) return new Map<number, string>();
  const useMedias = await db.orm.public.UseMedia.where((u) => u.id.in(useMediaIds)).select("id", "mediaId").all();
  const mediaIds = [...new Set(useMedias.map((u) => u.mediaId))];
  const medias = mediaIds.length
    ? await db.orm.public.Media.where((m) => m.id.in(mediaIds)).select("id", "url").all()
    : [];
  const mediaUrl = new Map(medias.map((m) => [m.id, m.url]));
  return new Map(useMedias.map((u) => [u.id, mediaUrl.get(u.mediaId) ?? ""]));
};

/**
 * Aggregate public product stats per seller (count, units sold, rating)
 */
const getStoreStats = async (sellerIds: number[]) => {
  if (sellerIds.length === 0) return new Map<number, { productCount: number; totalSold: number; reviewCount: number; rating: number }>();
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
      g.sellerId as number,
      {
        productCount: Number(g.count) || 0,
        totalSold: Number(g.sold) || 0,
        reviewCount: Number(g.reviews) || 0,
        rating: Math.round((Number(g.rating) || 0) * 10) / 10,
      },
    ])
  );
};

const toPublicStore = (
  seller: any,
  mediaMap: Map<number, string>,
  stats?: { productCount: number; totalSold: number; reviewCount: number; rating: number }
) => ({
  id: seller.id,
  storeName: seller.storeName,
  storeSlug: seller.storeSlug,
  storeLogo: (seller.logoUseMediaId && mediaMap.get(seller.logoUseMediaId)) || seller.storeLogo || null,
  storeBanner: (seller.bannerUseMediaId && mediaMap.get(seller.bannerUseMediaId)) || seller.storeBanner || null,
  storeDescription: seller.storeDescription ?? null,
  businessAddress: seller.businessAddress ?? null,
  isVerified: Boolean(seller.isVerified),
  createdAt: seller.createdAt,
  productCount: stats?.productCount ?? 0,
  totalSold: stats?.totalSold ?? 0,
  reviewCount: stats?.reviewCount ?? 0,
  rating: stats?.rating ?? 0,
});

const PUBLIC_STORE_FIELDS = [
  "id",
  "storeName",
  "storeSlug",
  "storeLogo",
  "storeBanner",
  "storeDescription",
  "businessAddress",
  "isVerified",
  "createdAt",
  "logoUseMediaId",
  "bannerUseMediaId",
] as const;

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
  const sellers = await query.select(...PUBLIC_STORE_FIELDS).all();
  const [stats, mediaMap] = await Promise.all([
    getStoreStats(sellers.map((s) => s.id)),
    resolveStoreMedia(sellers),
  ]);

  const stores = sellers.map((s) => toPublicStore(s, mediaMap, stats.get(s.id)));
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
  const seller = await db.orm.public.SellerProfile.where({ storeSlug }).select(...PUBLIC_STORE_FIELDS, "status").first();
  if (!seller || seller.status !== SELLER_STATUS.APPROVED) {
    throw new AppError("Seller store not found", 404);
  }
  const [stats, mediaMap] = await Promise.all([getStoreStats([seller.id]), resolveStoreMedia([seller])]);
  return toPublicStore(seller, mediaMap, stats.get(seller.id));
};

/**
 * Get seller's own dashboard stats & overview
 */
export const getSellerDashboardStats = async (userId: number) => {
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
    },
    recentOrders,
  };
};

/**
 * Seller update their own store profile
 */
export const updateSellerProfile = async (userId: number, payload: any) => {
  const seller = await db.orm.public.SellerProfile.where({ userId }).first();
  if (!seller) {
    throw new AppError("Seller profile not found", 404);
  }

  const updateData: any = {};
  if (payload.storeName && payload.storeName !== seller.storeName) {
    updateData.storeName = payload.storeName;
    updateData.storeSlug = slugify(payload.storeName);
  }
  if (payload.storeLogo !== undefined) updateData.storeLogo = payload.storeLogo;
  if (payload.logoUseMediaId !== undefined) {
    updateData.logoUseMediaId = payload.logoUseMediaId;
    if (payload.logoUseMediaId && !payload.storeLogo) {
      const useMedia = await db.orm.public.UseMedia.where({ id: payload.logoUseMediaId }).first();
      if (useMedia) {
        const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
        if (media) updateData.storeLogo = media.url;
      }
    }
  }
  if (payload.storeBanner !== undefined) updateData.storeBanner = payload.storeBanner;
  if (payload.bannerUseMediaId !== undefined) {
    updateData.bannerUseMediaId = payload.bannerUseMediaId;
    if (payload.bannerUseMediaId && !payload.storeBanner) {
      const useMedia = await db.orm.public.UseMedia.where({ id: payload.bannerUseMediaId }).first();
      if (useMedia) {
        const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
        if (media) updateData.storeBanner = media.url;
      }
    }
  }
  if (payload.storeDescription !== undefined) updateData.storeDescription = payload.storeDescription;
  if (payload.phone !== undefined) updateData.phone = payload.phone;
  if (payload.businessAddress !== undefined) updateData.businessAddress = payload.businessAddress;
  if (payload.bankName !== undefined) updateData.bankName = payload.bankName;
  if (payload.bankAccountNumber !== undefined) updateData.bankAccountNumber = payload.bankAccountNumber;
  if (payload.bankRouting !== undefined) updateData.bankRouting = payload.bankRouting;
  if (payload.bkashOrNagad !== undefined) updateData.bkashOrNagad = payload.bkashOrNagad;

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

  const sellers = await query.orderBy((s) => s.createdAt.desc()).all();

  // Populate user email and wallet
  const populated = await Promise.all(
    sellers.map(async (seller) => {
      const user = await db.orm.public.User.where({ id: seller.userId }).first();
      const wallet = await db.orm.public.SellerWallet.where({ sellerId: seller.id }).first();
      const productCount = await db.orm.public.Product
        .where({ sellerId: seller.id })
        .aggregate((a) => ({ count: a.count() }));

      return {
        ...seller,
        userEmail: user?.email,
        userName: user?.name,
        wallet,
        productCount: productCount.count,
      };
    })
  );

  return populated;
};

/**
 * Admin: Review seller application (Approve, Reject, Suspend, Commission Rate)
 */
export const adminReviewSellerApplication = async (
  sellerId: number,
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
    link: "/seller/dashboard",
  });

  return updatedSeller;
};

/**
 * Admin: Get comprehensive Seller Details, Financials, Performance, and Health/Risk Score
 */
export const adminGetSellerDetails = async (sellerId: number) => {
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
    recentProducts: products.slice(0, 8).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      mainImage: p.mainImage,
      basePrice: p.basePrice,
      stock: p.stock,
      status: p.status,
      approvalStatus: p.approvalStatus,
      ratingAverage: p.ratingAverage,
      createdAt: p.createdAt,
    })),
    recentOrders,
  };
};

/**
 * Admin: Send direct warning or system notice to seller
 */
export const adminSendSellerNotice = async (sellerId: number, title: string, message: string) => {
  const seller = await db.orm.public.SellerProfile.where({ id: sellerId }).first();
  if (!seller) throw new AppError("Seller not found", 404);

  await db.orm.public.Notification.create({
    userId: seller.userId,
    title,
    message,
    type: "SYSTEM",
    link: "/seller/dashboard",
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