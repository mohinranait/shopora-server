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
 * Admin: Get all users with filters
 */
export const adminGetAllUsers = async (filters: {
  role?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
  const offset = (page - 1) * limit;

  let query = db.orm.public.User;
  if (filters.role) {
    query = query.where({ role: filters.role });
  }
  if (filters.isActive !== undefined) {
    query = query.where({ isActive: filters.isActive });
  }

  const countResult = await query.aggregate((a) => ({ total: a.count() }));
  const users = await query
    .orderBy((u) => u.createdAt.desc())
    .limit(limit)
    .offset(offset)
    .all();

  return {
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      avatar: u.avatar,
      isActive: u.isActive,
      isVerified: u.isVerified,
      createdAt: u.createdAt,
    })),
    meta: {
      page,
      limit,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limit),
    },
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
  adminToggleUserStatus,
};
