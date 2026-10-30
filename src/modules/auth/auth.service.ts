import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import { hashPassword, comparePassword } from "../../utils/hash.ts";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utils/token.ts";
import { slugify } from "../../utils/slugify.ts";
import { USER_ROLES, SELLER_STATUS } from "../../constants/index.ts";
import { getAllSettings } from "../settings/settings.service.ts";

/**
 * Register a new Customer
 */
export const registerCustomer = async (payload: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) => {
  const existingUser = await db.orm.public.User.where({
    email: payload.email.toLowerCase().trim(),
  }).first();

  if (existingUser) {
    throw new AppError("An account with this email already exists", 409);
  }

  const hashedPassword = await hashPassword(payload.password);

  const newUser = await db.orm.public.User.create({
    name: payload.name,
    email: payload.email.toLowerCase().trim(),
    password: hashedPassword,
    role: USER_ROLES.CUSTOMER,
    phone: payload.phone ?? null,
  });

  const tokenPayload = {
    id: newUser.id,
    email: newUser.email,
    role: newUser.role,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  return {
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      phone: newUser.phone,
    },
    accessToken,
    refreshToken,
  };
};

/**
 * Register a new Seller with verification profile and wallet
 */
export const registerSeller = async (payload: {
  name: string;
  email: string;
  password: string;
  phone: string;
  storeName: string;
  storeDescription?: string;
  businessAddress: string;
  taxNumber?: string;
  nidOrTradeLicense?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankRouting?: string;
  bkashOrNagad?: string;
}) => {
  const email = payload.email.toLowerCase().trim();

  // Check email uniqueness
  const existingUser = await db.orm.public.User.where({ email }).first();
  if (existingUser) {
    throw new AppError("An account with this email already exists", 409);
  }

  // Generate unique store slug
  let storeSlug = slugify(payload.storeName);
  const existingStore = await db.orm.public.SellerProfile.where({
    storeSlug,
  }).first();

  if (existingStore) {
    storeSlug = `${storeSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const hashedPassword = await hashPassword(payload.password);

  // Execute in transaction: create User, SellerProfile and SellerWallet
  return await db.transaction(async (tx) => {
    // 1. Create User
    const user = await tx.orm.public.User.create({
      name: payload.name,
      email,
      password: hashedPassword,
      role: USER_ROLES.SELLER,
      phone: payload.phone,
    });

    // 2. Create Seller Profile (Verification Status: PENDING)
    const settings: Record<string, any> = await getAllSettings().catch(() => ({} as Record<string, any>));
    const autoApprove = Boolean(settings.auto_approve_sellers);
    const defaultCommission = typeof settings.default_commission_rate === "number" ? settings.default_commission_rate : 10.0;

    const seller = await tx.orm.public.SellerProfile.create({
      userId: user.id,
      storeName: payload.storeName,
      storeSlug,
      storeDescription: payload.storeDescription ?? null,
      phone: payload.phone,
      businessAddress: payload.businessAddress,
      taxNumber: payload.taxNumber ?? null,
      nidOrTradeLicense: payload.nidOrTradeLicense ?? null,
      bankName: payload.bankName ?? null,
      bankAccountNumber: payload.bankAccountNumber ?? null,
      bankRouting: payload.bankRouting ?? null,
      bkashOrNagad: payload.bkashOrNagad ?? null,
      status: autoApprove ? SELLER_STATUS.APPROVED : SELLER_STATUS.PENDING,
      commissionRate: defaultCommission,
      isVerified: autoApprove,
      verifiedAt: autoApprove ? new Date().toISOString() : null,
    });

    // 3. Initialize Seller Wallet
    await tx.orm.public.SellerWallet.create({
      sellerId: seller.id,
      balance: 0.0,
      pendingBalance: 0.0,
      totalWithdrawn: 0.0,
      totalEarnings: 0.0,
      totalCommissionPaid: 0.0,
    });

    // Notify Admins about new seller registration
    const admins = await tx.orm.public.User.where({ role: USER_ROLES.ADMIN, isActive: true }).all();
    for (const admin of admins) {
      await tx.orm.public.Notification.create({
        userId: admin.id,
        title: `New Seller Application: ${payload.storeName}`,
        message: `${payload.name} applied for a merchant account for "${payload.storeName}". Please review KYC documents.`,
        type: "KYC",
        link: `/admin/sellers/kyc`,
      });
    }

    // Send welcome notification to seller
    await tx.orm.public.Notification.create({
      userId: user.id,
      title: `Welcome to Shopora Seller Center!`,
      message: autoApprove
        ? `Your store "${payload.storeName}" has been approved! You can now start adding products.`
        : `Your application for "${payload.storeName}" has been received and is currently under review by our team.`,
      type: "KYC",
      link: `/seller/dashboard`,
    });

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      sellerId: seller.id,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
      seller: {
        id: seller.id,
        storeName: seller.storeName,
        storeSlug: seller.storeSlug,
        status: seller.status,
      },
      accessToken,
      refreshToken,
    };
  });
};

/**
 * Login for all users (Customer, Seller, Admin)
 */
export const loginUser = async (payload: {
  email: string;
  password: string;
}) => {
  const email = payload.email.toLowerCase().trim();

  // Find user by email
  const user = await db.orm.public.User.where({ email }).first();
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw new AppError("Your account has been deactivated. Please contact support.", 403);
  }

  // Verify password
  const isPasswordMatch = await comparePassword(payload.password, user.password);
  if (!isPasswordMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  let sellerProfile = null;
  if (user.role === USER_ROLES.SELLER) {
    sellerProfile = await db.orm.public.SellerProfile.where({ userId: user.id }).first();
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    sellerId: sellerProfile ? sellerProfile.id : null,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  let avatarUseMedia: any = null;
  const userAvatarId = (user as any).avatarId ?? (user as any).avatarUseMediaId;
  if (userAvatarId) {
    const um = await db.orm.public.UseMedia.where({ id: userAvatarId }).first();
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
      avatarId: userAvatarId ?? null,
      avatarUseMediaId: userAvatarId ?? null,
      avatarUseMedia,
      avatar: avatarUseMedia?.media?.url ?? null,
      sellerProfile: sellerProfile
        ? {
            id: sellerProfile.id,
            storeName: sellerProfile.storeName,
            storeSlug: sellerProfile.storeSlug,
            status: sellerProfile.status,
          }
        : null,
    },
    accessToken,
    refreshToken,
  };
};

/**
 * Get currently authenticated user profile
 */
export const getMe = async (userId: number) => {
  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user) {
    throw new AppError("User not found", 404);
  }

  let seller = null;
  if (user.role === USER_ROLES.SELLER) {
    seller = await db.orm.public.SellerProfile.where({ userId: user.id }).first();
  }

  let avatarUseMedia: any = null;
  const meAvatarId = (user as any).avatarId ?? (user as any).avatarUseMediaId;
  if (meAvatarId) {
    const um = await db.orm.public.UseMedia.where({ id: meAvatarId }).first();
    if (um) {
      const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
      avatarUseMedia = { ...um, media: m };
    }
  }

  const addresses = await db.orm.public.Address.where({ userId: user.id }).all();

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    avatarId: meAvatarId ?? null,
    avatarUseMediaId: meAvatarId ?? null,
    avatarUseMedia,
    avatar: avatarUseMedia?.media?.url ?? null,
    isActive: user.isActive,
    isVerified: user.isVerified,
    sellerProfile: seller,
    addresses,
    createdAt: user.createdAt,
  };
};

/**
 * Refresh Access Token
 */
export const refreshUserToken = async (refreshToken: string) => {
  try {
    const decoded = verifyRefreshToken(refreshToken);

    const user = await db.orm.public.User.where({ id: decoded.id }).first();
    if (!user || !user.isActive) {
      throw new AppError("User account invalid or deactivated", 401);
    }

    let sellerId = null;
    if (user.role === USER_ROLES.SELLER) {
      const seller = await db.orm.public.SellerProfile.where({ userId: user.id }).first();
      sellerId = seller ? seller.id : null;
    }

    const newAccessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
      sellerId,
    });

    return {
      accessToken: newAccessToken,
    };
  } catch (err: any) {
    throw new AppError("Invalid or expired refresh token", 401);
  }
};

/**
 * Change User Password
 */
export const changePassword = async (
  userId: number,
  payload: { oldPassword: string; newPassword: string }
) => {
  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const isOldMatch = await comparePassword(payload.oldPassword, user.password);
  if (!isOldMatch) {
    throw new AppError("Current password is incorrect", 400);
  }

  const newHashed = await hashPassword(payload.newPassword);

  await db.orm.public.User.where({ id: userId }).update({
    password: newHashed,
  });

  return { message: "Password updated successfully" };
};

export const AuthService = {
  registerCustomer,
  registerSeller,
  loginUser,
  getMe,
  refreshUserToken,
  changePassword,
};
