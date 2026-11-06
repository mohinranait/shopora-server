/**
 * Slider Module TypeScript Interfaces
 */

import type { IUseMediaWithMedia } from "../brands/brand.interface.ts";

export interface ISliderRecord {
  id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  badgeText: string | null;
  type: string;
  linkUrl: string | null;
  buttonText: string | null;
  bgGradient: string | null;
  bgColor: string | null;
  textColor: string;
  displayOrder: number;
  isActive: boolean;
  imageId: string | null;
  mobileImageId: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ISliderPopulated extends ISliderRecord {
  useMedia: IUseMediaWithMedia | null;
  mobileUseMedia: IUseMediaWithMedia | null;
  image: IUseMediaWithMedia | null;
  mobileImage: IUseMediaWithMedia | null;
  imageUrl: string | null;
  mobileImageUrl: string | null;
}

export interface ICreateSliderInput {
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  badgeText?: string | null;
  type?: string;
  linkUrl?: string | null;
  buttonText?: string | null;
  bgGradient?: string | null;
  bgColor?: string | null;
  textColor?: string;
  displayOrder?: number;
  isActive?: boolean;
  imageId?: string | null;
  useMediaId?: string | null;
  mobileImageId?: string | null;
  mobileUseMediaId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface IUpdateSliderInput extends Partial<ICreateSliderInput> {}
