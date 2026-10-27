import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";

/**
 * Update current user profile
 */
export const updateProfile = async (
  userId: number,
  payload: { name?: string; phone?: string; avatar?: string; avatarUseMediaId?: number | null }
) => {
  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const updateData: any = {};
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.phone !== undefined) updateData.phone = payload.phone;
  if (payload.avatar !== undefined) updateData.avatar = payload.avatar;
  if (payload.avatarUseMediaId !== undefined) {
    updateData.avatarUseMediaId = payload.avatarUseMediaId;
    if (payload.avatarUseMediaId && !payload.avatar) {
      const useMedia = await db.orm.public.UseMedia.where({ id: payload.avatarUseMediaId }).first();
      if (useMedia) {
        const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
        if (media) updateData.avatar = media.url;
      }
    }
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
    avatar: updated.avatar,
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
  const [orders, addresses] = await Promise.all([
    userIds.length > 0 ? db.orm.public.Order.where((o) => o.userId.in(userIds)).all() : [],
    userIds.length > 0 ? db.orm.public.Address.where((a) => a.userId.in(userIds)).all() : [],
  ]);

  const enrichedUsers = users.map((u) => {
    const userOrders = orders.filter((o) => o.userId === u.id);
    const userAddresses = addresses.filter((a) => a.userId === u.id);
    const validOrders = userOrders.filter((o) => o.orderStatus !== "CANCELLED");
    const totalSpent = validOrders.reduce((acc, o) => acc + (Number(o.totalAmount) || 0), 0);
    const defaultAddress = userAddresses.find((a) => a.isDefault) || userAddresses[0] || null;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      avatar: u.avatar,
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

  const enrichedReviews = reviews.map((r) => {
    const product = products.find((p) => p.id === r.productId);
    return {
      ...r,
      product: product
        ? {
            id: product.id,
            name: product.name,
            slug: product.slug,
            mainImage: product.mainImage,
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

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
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

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    phone: updated.phone,
    avatar: updated.avatar,
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
