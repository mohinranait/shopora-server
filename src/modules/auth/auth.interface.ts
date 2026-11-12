/**
 * Auth Module TypeScript Interfaces
 */

import type { IUseMediaWithMedia } from "../brands/brand.interface.ts";

export interface IRegisterCustomerInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface IRegisterSellerInput {
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
}

export interface ILoginInput {
  email: string;
  password: string;
}

export interface IChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}

export interface IAuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
}

export interface ISellerProfileSummary {
  id: string;
  storeName: string;
  storeSlug: string;
  status: string;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IUserAvatarFields {
  avatarId: string | null;
  avatarUseMediaId: string | null;
  avatarUseMedia: IUseMediaWithMedia | null;
  avatar: string | null;
}

export interface IRegisterCustomerResponse extends IAuthTokens {
  user: IAuthUser;
}

export interface IRegisterSellerResponse extends IAuthTokens {
  user: IAuthUser;
  seller: ISellerProfileSummary;
}

export interface ILoginUser extends IAuthUser, IUserAvatarFields {
  sellerProfile: ISellerProfileSummary | null;
}

export interface ILoginResponse extends IAuthTokens {
  user: ILoginUser;
}

export interface IMeResponse extends IAuthUser, IUserAvatarFields {
  isActive: boolean;
  isVerified: boolean;
  sellerProfile: any;
  addresses: any[];
  createdAt: string | Date;
}

export interface IRefreshTokenResponse {
  accessToken: string;
}

export interface IChangePasswordResponse {
  message: string;
}
