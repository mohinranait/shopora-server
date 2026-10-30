import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";

/**
 * Update current user profile
 */
export const updateProfile = async (
  userId: number,
  payload: { name?: string; phone?: string; avatarUseMediaId?: number | null }
) => {
  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const updateData: any = {};
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.phone !== undefined) updateData.phone = payload.phone;
  if (payload.avatarUseMediaId !== undefined) {
    updateData.avatarUseMediaId = payload.avatarUseMediaId;
  }

  const updated = await db.orm.public.User.where({ id: userId }).update(updateData);
  if (!updated) {
    throw new AppError("Failed to update profile", 500);
  }

  let avatarUseMedia: any = null;
  if (updated.avatarUseMediaId) {
    const um = await db.orm.public.UseMedia.where({ id: updated.avatarUseMediaId }).first();
    if (um) {
      const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
      avatarUseMedia = { ...um, media: m };
    }
  }

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    phone: updated.phone,
    avatar: avatarUseMedia?.media?.url ?? null,
    avatarUseMediaId: updated.avatarUseMediaId,
    avatarUseMedia,
  };
};

/**
 * Add an address for user
 */
export const addAddress = async (userId: number, payload: any) => {
  if (payload.isDefault) {
    // Reset any existing default address
    await db.orm.public.Address
      .where({ userId })
      .where({ isDefault: true })
      .update({ isDefault: false });
  }

  return await db.orm.public.Address.create({
    userId,
    fullName: payload.fullName,
    phone: payload.phone,
    streetAddress: payload.streetAddress,
    city: payload.city,
    state: payload.state ?? null,
    postalCode: payload.postalCode ?? null,
    country: payload.country || "Bangladesh",
    isDefault: payload.isDefault || false,
    type: payload.type || "SHIPPING",
  });
};

/**
 * Get user addresses
 */
export const getUserAddresses = async (userId: number) => {
  return await db.orm.public.Address
    .where({ userId })
    .orderBy((a) => a.createdAt.desc())
    .all();
};

/**
 * Delete address
 */
export const deleteAddress = async (addressId: number, userId: number) => {
  const address = await db.orm.public.Address.where({ id: addressId }).first();
  if (!address) {
    throw new AppError("Address not found", 404);
  }

  if (address.userId !== userId) {
    throw new AppError("Unauthorized access to address", 403);
  }

  return await db.orm.public.Address.where({ id: addressId }).delete();
};

/**
 * Admin: Get all users with search, filters, pagination and order/address summaries
 */
export const adminGetAllUsers = async (filters: {
  role?: string;
  isActive?: boolean;
  isVerified?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
  const offset = (page - 1) * limit;

  let query = db.orm.public.User;
  if (filters.role && filters.role !== "ALL") {
    query = query.where({ role: filters.role });
  }
  if (filters.isActive !== undefined) {
    query = query.where({ isActive: filters.isActive });
  }
  if (filters.isVerified !== undefined) {
    query = query.where({ isVerified: filters.isVerified });
  }
  if (filters.search && filters.search.trim()) {
    const pattern = `%${filters.search.trim()}%`;
    query = query.where((u, { fns }) =>
      fns.or(
        u.name.ilike(pattern),
        u.email.ilike(pattern),
        u.phone.ilike(pattern)
      )
    );
  }

  const [countResult, totalCustomersAgg, activeCustomersAgg, verifiedCustomersAgg] = await Promise.all([
    query.aggregate((a) => ({ total: a.count() })),
    db.orm.public.User.where({ role: "CUSTOMER" }).aggregate((a) => ({ total: a.count() })),
    db.orm.public.User.where({ role: "CUSTOMER", isActive: true }).aggregate((a) => ({ total: a.count() })),
    db.orm.public.User.where({ role: "CUSTOMER", isVerified: true }).aggregate((a) => ({ total: a.count() })),
  ]);

  const users = await query
    .orderBy((u) => u.createdAt.desc())
    .limit(limit)
    .offset(offset)
    .all();

  const userIds = users.map((u) => u.id);
  const avatarUseMediaIds = [...new Set(users.map((u) => u.avatarUseMediaId).filter((id): id is number => typeof id === "number"))];

  const [orders, addresses, useMedias] = await Promise.all([
    userIds.length > 0 ? db.orm.public.Order.where((o) => o.userId.in(userIds)).all() : [],
    userIds.length > 0 ? db.orm.public.Address.where((a) => a.userId.in(userIds)).all() : [],
    avatarUseMediaIds.length > 0 ? db.orm.public.UseMedia.where((um) => um.id.in(avatarUseMediaIds)).all() : [],
  ]);

  const mediaIds = [...new Set(useMedias.map((um) => um.mediaId))];
  const medias = mediaIds.length > 0 ? await db.orm.public.Media.where((m) => m.id.in(mediaIds)).all() : [];
  const mediaMap = new Map(medias.map((m) => [m.id, m]));
  const useMediaMap = new Map(useMedias.map((um) => [um.id, { ...um, media: mediaMap.get(um.mediaId) ?? null }]));

  const enrichedUsers = users.map((u) => {
    const userOrders = orders.filter((o) => o.userId === u.id);
    const userAddresses = addresses.filter((a) => a.userId === u.id);
    const validOrders = userOrders.filter((o) => o.orderStatus !== "CANCELLED");
    const totalSpent = validOrders.reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);
    const defaultAddress = userAddresses.find((a) => a.isDefault) || userAddresses[0] || null;
    const avatarUseMedia = u.avatarUseMediaId ? useMediaMap.get(u.avatarUseMediaId) ?? null : null;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      avatarUseMediaId: u.avatarUseMediaId,
      avatarUseMedia,
      avatar: avatarUseMedia?.media?.url ?? null,
      isActive: u.isActive,
      isVerified: u.isVerified,
      createdAt: u.createdAt,
      ordersCount: userOrders.length,
      totalSpent,
      addresses: userAddresses,
      defaultAddress,
    };
  });

  return {
    users: enrichedUsers,
    meta: {
      page,
      limit,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limit),
      counts: {
        totalCustomers: totalCustomersAgg.total,
        activeCustomers: activeCustomersAgg.total,
        verifiedCustomers: verifiedCustomersAgg.total,
      },
    },
  };
};

/**
 * Admin: Get customer detail with order history, addresses, and statistics
 */
export const adminGetUserDetail = async (userId: number) => {
  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user) {
    throw new AppError("Customer not found", 404);
  }

  const [addresses, orders, reviews] = await Promise.all([
    db.orm.public.Address.where({ userId }).orderBy((a) => a.createdAt.desc()).all(),
    db.orm.public.Order.where({ userId }).orderBy((o) => o.createdAt.desc()).limit(20).all(),
    db.orm.public.ProductReview.where({ userId }).orderBy((r) => r.createdAt.desc()).limit(10).all(),
  ]);

  const orderIds = orders.map((o) => o.id);
  const orderItems = orderIds.length > 0
    ? await db.orm.public.OrderItem.where((oi) => oi.orderId.in(orderIds)).all()
    : [];

  const enrichedOrders = orders.map((o) => {
    const items = orderItems.filter((oi) => oi.orderId === o.id);
    const itemsCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    return {
      ...o,
      itemsCount,
    };
  });

  // Fetch product metadata for customer reviews
  const reviewProductIds = reviews.map((r) => r.productId);
  const products = reviewProductIds.length > 0
    ? await db.orm.public.Product.where((p) => p.id.in(reviewProductIds)).all()
    : [];

  const productMainMediaIds = [...new Set(products.map((p) => p.mainImageUseMediaId).filter((id): id is number => typeof id === "number"))];
  const productUseMedias = productMainMediaIds.length > 0
    ? await db.orm.public.UseMedia.where((um) => um.id.in(productMainMediaIds)).all()
    : [];
  const prodMediaIds = [...new Set(productUseMedias.map((um) => um.mediaId))];
  const prodMedias = prodMediaIds.length > 0
    ? await db.orm.public.Media.where((m) => m.id.in(prodMediaIds)).all()
    : [];
  const prodMediaMap = new Map(prodMedias.map((m) => [m.id, m.url]));
  const prodUseMediaMap = new Map(productUseMedias.map((um) => [um.id, prodMediaMap.get(um.mediaId) ?? ""]));

  const enrichedReviews = reviews.map((r) => {
    const product = products.find((p) => p.id === r.productId);
    const mainImageUrl = product?.mainImageUseMediaId ? prodUseMediaMap.get(product.mainImageUseMediaId) ?? null : null;
    return {
      ...r,
      product: product
        ? {
            id: product.id,
            name: product.name,
            slug: product.slug,
            mainImage: mainImageUrl,
            mainImageUseMediaId: product.mainImageUseMediaId,
          }
        : null,
    };
  });

  const validOrders = orders.filter((o) => o.orderStatus !== "CANCELLED");
  const totalSpent = validOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const deliveredOrders = orders.filter((o) => o.orderStatus === "DELIVERED").length;
  const cancelledOrders = orders.filter((o) => o.orderStatus === "CANCELLED").length;
  const pendingOrders = orders.filter((o) =>
    ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"].includes(o.orderStatus)
  ).length;

  let avatarUseMedia: any = null;
  if (user.avatarUseMediaId) {
    const um = await db.orm.public.UseMedia.where({ id: user.avatarUseMediaId }).first();
    if (um) {
      const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
      avatarUseMedia = { ...um, media: m };
    }
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatarUseMediaId: user.avatarUseMediaId,
      avatarUseMedia,
      avatar: avatarUseMedia?.media?.url ?? null,
      isActive: user.isActive,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    addresses,
    orders: enrichedOrders,
    reviews: enrichedReviews,
    stats: {
      totalOrders: orders.length,
      totalSpent,
      deliveredOrders,
      cancelledOrders,
      pendingOrders,
    },
  };
};

/**
 * Admin: Update customer profile details
 */
export const adminUpdateUser = async (
  userId: number,
  payload: {
    name?: string;
    email?: string;
    phone?: string | null;
    isActive?: boolean;
    isVerified?: boolean;
    role?: "CUSTOMER" | "SELLER" | "ADMIN";
  }
) => {
  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user) {
    throw new AppError("Customer not found", 404);
  }

  const updateData: any = {};
  if (payload.name !== undefined) updateData.name = payload.name.trim();

  if (payload.email !== undefined && payload.email.trim() !== user.email) {
    const trimmedEmail = payload.email.trim().toLowerCase();
    const existingEmail = await db.orm.public.User.where({ email: trimmedEmail }).first();
    if (existingEmail && existingEmail.id !== userId) {
      throw new AppError("A user with this email address already exists", 400);
    }
    updateData.email = trimmedEmail;
  }

  if (payload.phone !== undefined) {
    const rawPhone = payload.phone?.trim() || null;
    if (rawPhone && rawPhone !== user.phone) {
      const existingPhone = await db.orm.public.User.where({ phone: rawPhone }).first();
      if (existingPhone && existingPhone.id !== userId) {
        throw new AppError("A user with this phone number already exists", 400);
      }
    }
    updateData.phone = rawPhone;
  }

  if (payload.isActive !== undefined) updateData.isActive = payload.isActive;
  if (payload.isVerified !== undefined) updateData.isVerified = payload.isVerified;
  if (payload.role !== undefined) updateData.role = payload.role;

  const updated = await db.orm.public.User.where({ id: userId }).update(updateData);
  if (!updated) {
    throw new AppError("Failed to update customer", 500);
  }

  let avatarUseMedia: any = null;
  if (updated.avatarUseMediaId) {
    const um = await db.orm.public.UseMedia.where({ id: updated.avatarUseMediaId }).first();
    if (um) {
      const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
      avatarUseMedia = { ...um, media: m };
    }
  }

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    phone: updated.phone,
    avatarUseMediaId: updated.avatarUseMediaId,
    avatarUseMedia,
    avatar: avatarUseMedia?.media?.url ?? null,
    isActive: updated.isActive,
    isVerified: updated.isVerified,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
};

/**
 * Admin: Toggle user active status
 */
export const adminToggleUserStatus = async (userId: number, isActive: boolean) => {
  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user) {
    throw new AppError("User not found", 404);
  }

  return await db.orm.public.User.where({ id: userId }).update({
    isActive,
  });
};

export const UserService = {
  updateProfile,
  addAddress,
  getUserAddresses,
  deleteAddress,
  adminGetAllUsers,
  adminGetUserDetail,
  adminUpdateUser,
  adminToggleUserStatus,
};
