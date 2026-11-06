/**
 * Brand Module TypeScript Interfaces
 */

export interface IMediaRecord {
  id: string;
  url: string;
  publicId: string;
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  originalFilename: string | null;
  folder: string | null;
  userId: string;
  sellerId: string | null;
  createdAt: string;
}

export interface IUseMediaWithMedia {
  id: string;
  mediaId: string;
  alt: string | null;
  description: string | null;
  userId: string;
  sellerId: string | null;
  media: IMediaRecord | null;
}

export interface IBrandRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  logoId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IBrandPopulated extends IBrandRecord {
  logo?: IUseMediaWithMedia | any;
  useMedia?: IUseMediaWithMedia | null;
}

export interface ICreateBrandInput {
  name: string;
  logoId?: string | null;
  useMediaId?: string | null;
  description?: string | null;
  website?: string | null;
  isActive?: boolean;
}

export interface IUpdateBrandInput {
  name?: string;
  logoId?: string | null;
  useMediaId?: string | null;
  description?: string | null;
  website?: string | null;
  isActive?: boolean;
}

export interface IBrandUpdateDbPayload {
  name?: string;
  slug?: string;
  logoId?: string | null;
  description?: string | null;
  website?: string | null;
  isActive?: boolean;
}
