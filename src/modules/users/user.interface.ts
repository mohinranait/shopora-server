/**
 * User Module TypeScript Interfaces
 */

import type { UserRole } from "../../constants/index.ts";
import type { IAuthUser, IUserAvatarFields } from "../auth/auth.interface.ts";

export interface IUpdateProfileInput {
  name?: string;
  phone?: string;
  avatar?: string | null;
  avatarId?: string | null;
  avatarUseMediaId?: string | null;
}

export interface IAddAddressInput {
  fullName: string;
  phone: string;
  streetAddress: string;
  city: string;
  state?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
  type?: "SHIPPING" | "BILLING";
}

export interface IAdminUserFilters {
  role?: string;
  isActive?: boolean;
  isVerified?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IAdminUpdateUserInput {
  name?: string;
  email?: string;
  phone?: string | null;
  isActive?: boolean;
  isVerified?: boolean;
  role?: UserRole;
}

export interface IUserUpdateDbPayload {
  name?: string;
  email?: string;
  phone?: string | null;
  avatarId?: string | null;
  isActive?: boolean;
  isVerified?: boolean;
  role?: UserRole;
}

export interface IUserProfileResponse extends IAuthUser, IUserAvatarFields {
  isActive: boolean;
  isVerified: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface IAdminUserListItem extends IAuthUser, IUserAvatarFields {
  isActive: boolean;
  isVerified: boolean;
  createdAt: string | Date;
  ordersCount: number;
  totalSpent: number;
  addresses: any[];
  defaultAddress: any | null;
}

export interface IAdminUsersMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  counts: {
    totalCustomers: number;
    activeCustomers: number;
    verifiedCustomers: number;
  };
}

export interface IAdminUsersResponse {
  users: IAdminUserListItem[];
  meta: IAdminUsersMeta;
}

export interface IUserOrderStats {
  totalOrders: number;
  totalSpent: number;
  deliveredOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
}

export interface IAdminUserDetailResponse {
  user: IUserProfileResponse;
  addresses: any[];
  orders: any[];
  reviews: any[];
  stats: IUserOrderStats;
}
