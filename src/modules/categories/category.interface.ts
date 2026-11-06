/**
 * Category Module TypeScript Interfaces
 */

import type { IUseMediaWithMedia } from "../brands/brand.interface.ts";

export interface ICategoryRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageId: string | null;
  icon: string | null;
  parentId: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ICategoryPopulated extends ICategoryRecord {
  useMedia: IUseMediaWithMedia | null;
  image: string | null;
}

export interface ICategoryTreeNode extends ICategoryPopulated {
  children: ICategoryTreeNode[];
}

export interface ICategoryFlatListItem extends ICategoryPopulated {
  parent: { id: string; name: string; slug: string } | null;
}

export interface ICategoryDetailResponse extends ICategoryPopulated {
  parent: ICategoryPopulated | null;
  children: ICategoryPopulated[];
}

export interface ICreateCategoryInput {
  name: string;
  description?: string | null;
  imageId?: string | null;
  useMediaId?: string | null;
  icon?: string | null;
  parentId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface IUpdateCategoryInput {
  name?: string;
  description?: string | null;
  imageId?: string | null;
  useMediaId?: string | null;
  icon?: string | null;
  parentId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}

export interface ICategoryUpdateDbPayload {
  name?: string;
  slug?: string;
  description?: string | null;
  imageId?: string | null;
  icon?: string | null;
  parentId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}
