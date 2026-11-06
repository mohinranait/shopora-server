/**
 * Seller Module TypeScript Interfaces
 */

import type { IUseMediaWithMedia } from "../brands/brand.interface.ts";

export interface IPublicStoreFilters {
  search?: string;
  sortBy?: "popular" | "rating" | "products" | "newest" | "name";
  verifiedOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface IUpdateSellerProfilePayload {
  storeName?: string;
  logoId?: string | null;
  logoUseMediaId?: string | null;
  bannerId?: string | null;
  bannerUseMediaId?: string | null;
  storeDescription?: string | null;
  phone?: string | null;
  businessAddress?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankRouting?: string | null;
  bkashOrNagad?: string | null;
  isHolidayMode?: boolean;
  holidayMessage?: string | null;
}

export interface ISellerProfileRecord {
  id: string;
  userId: string;
  storeName: string;
  storeSlug: string;
  storeDescription: string | null;
  logoId: string | null;
  bannerId: string | null;
  phone: string | null;
  businessAddress: string | null;
  status: string;
  commissionRate: number;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankRouting: string | null;
  bkashOrNagad: string | null;
  isHolidayMode: boolean;
  holidayMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ISellerDashboardOverview {
  metrics: {
    totalSales: number;
    totalOrders: number;
    activeProducts: number;
    pendingPayout: number;
    activeStockInvestment: number;
    grossSales: number;
    costOfGoodsSold: number;
    netProfit: number;
    profitMarginPercent: number;
  };
  seller: {
    id: string;
    storeName: string;
    storeSlug: string;
    commissionRate: number;
    status: string;
    storeLogo: string | null;
    logoUseMedia: IUseMediaWithMedia | null;
    storeBanner: string | null;
    bannerUseMedia: IUseMediaWithMedia | null;
    isHolidayMode: boolean;
    holidayMessage: string | null;
  };
  recentSubOrders: any[];
}
