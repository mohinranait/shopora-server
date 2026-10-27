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

export const SellerService = {
  getPublicStores,
  getPublicStoreBySlug,
  getStoreBySlug,
  getSellerDashboardStats,
  updateSellerProfile,
  adminGetAllSellers,
  adminReviewSellerApplication,
};
