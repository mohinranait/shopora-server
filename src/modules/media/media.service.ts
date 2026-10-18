import { db } from "../../config/db.ts";
import { ENV } from "../../config/env.ts";
import { AppError } from "../../errors/AppError.ts";
import { cloudinary, type UploadApiResponse } from "../../lib/cloudinary.ts";
import { USER_ROLES } from "../../constants/index.ts";

/**
 * Upload a file buffer directly to Cloudinary using upload_stream
 * @param buffer In-memory file buffer from multer
 * @param options Folder and custom public_id options
 */
export const uploadToCloudinary = async (
  buffer: Buffer,
  options?: { folder?: string; filename?: string }
): Promise<UploadApiResponse> => {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const folder = options?.folder || ENV.cloudinary_folder || "shopora";
    
    cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        folder,
        public_id: options?.filename ? options.filename.replace(/\.[^/.]+$/, "") : undefined,
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return reject(new AppError(`Cloudinary upload failed: ${error.message || "Unknown error"}`, 500));
        }
        if (!result) {
          return reject(new AppError("No result returned from Cloudinary", 500));
        }
        resolve(result);
      }
    ).end(buffer);
  });
};

/**
 * Upload single image to Cloudinary and record raw metadata in Media model
 */
export const uploadSingleMedia = async (
  file: Express.Multer.File,
  user: { id: number; sellerId?: number | null },
  folder?: string
) => {
  if (!file || !file.buffer) {
    throw new AppError("No image file provided for upload", 400);
  }

  // 1. Upload stream to Cloudinary
  const cloudinaryResult = await uploadToCloudinary(file.buffer, {
    folder: folder || ENV.cloudinary_folder || "shopora",
    filename: file.originalname,
  });

  // 2. Persist uploaded metadata in Media model
  const media = await db.orm.public.Media.create({
    url: cloudinaryResult.secure_url,
    publicId: cloudinaryResult.public_id,
    format: cloudinaryResult.format ?? null,
    bytes: cloudinaryResult.bytes ?? null,
    width: cloudinaryResult.width ?? null,
    height: cloudinaryResult.height ?? null,
    originalFilename: file.originalname ?? null,
    folder: folder || ENV.cloudinary_folder || "shopora",
    userId: user.id,
    sellerId: user.sellerId ?? null,
  });

  return media;
};

/**
 * Upload multiple images concurrently to Cloudinary and save all to Media model
 */
export const uploadMultipleMedia = async (
  files: Express.Multer.File[],
  user: { id: number; sellerId?: number | null },
  folder?: string
) => {
  if (!files || files.length === 0) {
    throw new AppError("No image files provided for upload", 400);
  }

  const uploadPromises = files.map((file) => uploadSingleMedia(file, user, folder));
  return await Promise.all(uploadPromises);
};

/**
 * Fetch uploaded media library with filtering and pagination
 */
export const getMyMediaLibrary = async (
  user: { id: number; role: string; sellerId?: number | null },
  query: { page?: number; limit?: number; folder?: string }
) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  let mediaQuery = db.orm.public.Media;

  // Role based filtering: Admins can inspect all assets, sellers inspect their store assets, customers inspect their own
  if (user.role === USER_ROLES.ADMIN) {
    // Admin sees all media
  } else if (user.role === USER_ROLES.SELLER && user.sellerId) {
    mediaQuery = mediaQuery.where({ sellerId: user.sellerId });
  } else {
    mediaQuery = mediaQuery.where({ userId: user.id });
  }

  if (query.folder) {
    mediaQuery = mediaQuery.where({ folder: query.folder });
  }

  const countResult = await mediaQuery.aggregate((a) => ({ total: a.count() }));
  const total = Number(countResult.total || 0);
  const items = await mediaQuery.orderBy((m) => m.createdAt.desc()).limit(limit).offset(offset).all();

  return {
    media: items,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

/**
 * Get single raw media asset by ID
 */
export const getMediaById = async (
  id: number,
  user: { id: number; role: string; sellerId?: number | null }
) => {
  const media = await db.orm.public.Media.where({ id }).first();
  if (!media) {
    throw new AppError("Media asset not found", 404);
  }

  // Authorization check
  if (
    user.role !== USER_ROLES.ADMIN &&
    media.userId !== user.id &&
    (!user.sellerId || media.sellerId !== user.sellerId)
  ) {
    throw new AppError("Forbidden: You do not have permission to access this media", 403);
  }

  return media;
};

/**
 * Delete media asset from Cloudinary and database
 */
export const deleteMedia = async (
  id: number,
  user: { id: number; role: string; sellerId?: number | null }
) => {
  const media = await getMediaById(id, user);

  // 1. Delete from Cloudinary
  try {
    await cloudinary.uploader.destroy(media.publicId);
  } catch (err) {
    console.warn(`Cloudinary deletion warning for publicId ${media.publicId}:`, err);
  }

  // 2. Delete from DB (UseMedia records cascade delete)
  await db.orm.public.Media.where({ id }).delete();

  return { message: "Media deleted successfully from storage and library", id };
};

/**
 * Create a UseMedia record when an uploaded image is selected from the library
 * Attaches alt and description to the selected mediaId
 */
export const createUseMedia = async (
  user: { id: number; role: string; sellerId?: number | null },
  payload: { mediaId: number; alt?: string; description?: string }
) => {
  // Validate that media exists
  const media = await db.orm.public.Media.where({ id: payload.mediaId }).first();
  if (!media) {
    throw new AppError("Media asset not found. Please upload the image first.", 404);
  }

  // Check ownership unless admin
  if (
    user.role !== USER_ROLES.ADMIN &&
    media.userId !== user.id &&
    (!user.sellerId || media.sellerId !== user.sellerId)
  ) {
    throw new AppError("Forbidden: You can only configure media from your own library", 403);
  }

  // Create UseMedia record
  const useMedia = await db.orm.public.UseMedia.create({
    mediaId: media.id,
    alt: payload.alt ?? null,
    description: payload.description ?? null,
    userId: user.id,
    sellerId: user.sellerId ?? null,
  });

  return {
    ...useMedia,
    media: {
      id: media.id,
      url: media.url,
      publicId: media.publicId,
      format: media.format,
      bytes: media.bytes,
      width: media.width,
      height: media.height,
      originalFilename: media.originalFilename,
    },
  };
};

/**
 * Fetch configured UseMedia items with joined Media details
 */
export const getUseMediaLibrary = async (
  user: { id: number; role: string; sellerId?: number | null },
  query: { page?: number; limit?: number }
) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  let useMediaQuery = db.orm.public.UseMedia;

  if (user.role === USER_ROLES.ADMIN) {
    // Admin sees all UseMedia
  } else if (user.role === USER_ROLES.SELLER && user.sellerId) {
    useMediaQuery = useMediaQuery.where({ sellerId: user.sellerId });
  } else {
    useMediaQuery = useMediaQuery.where({ userId: user.id });
  }

  const countResult = await useMediaQuery.aggregate((a) => ({ total: a.count() }));
  const total = Number(countResult.total || 0);
  const items = await useMediaQuery.orderBy((u) => u.createdAt.desc()).limit(limit).offset(offset).all();

  // Populate media object for each UseMedia record
  const populated = await Promise.all(
    items.map(async (u) => {
      const media = await db.orm.public.Media.where({ id: u.mediaId }).first();
      return {
        id: u.id,
        mediaId: u.mediaId,
        alt: u.alt,
        description: u.description,
        userId: u.userId,
        sellerId: u.sellerId,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        media: media
          ? {
              id: media.id,
              url: media.url,
              publicId: media.publicId,
              format: media.format,
              bytes: media.bytes,
              width: media.width,
              height: media.height,
              originalFilename: media.originalFilename,
            }
          : null,
      };
    })
  );

  return {
    useMedia: populated,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

/**
 * Get single UseMedia record by ID with joined Media
 */
export const getUseMediaById = async (id: number) => {
  const useMedia = await db.orm.public.UseMedia.where({ id }).first();
  if (!useMedia) {
    throw new AppError("UseMedia record not found", 404);
  }

  const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();

  return {
    id: useMedia.id,
    mediaId: useMedia.mediaId,
    alt: useMedia.alt,
    description: useMedia.description,
    userId: useMedia.userId,
    sellerId: useMedia.sellerId,
    createdAt: useMedia.createdAt,
    updatedAt: useMedia.updatedAt,
    media: media
      ? {
          id: media.id,
          url: media.url,
          publicId: media.publicId,
          format: media.format,
          bytes: media.bytes,
          width: media.width,
          height: media.height,
          originalFilename: media.originalFilename,
        }
      : null,
  };
};

/**
 * Update UseMedia alt text or description
 */
export const updateUseMedia = async (
  id: number,
  user: { id: number; role: string; sellerId?: number | null },
  payload: { alt?: string; description?: string }
) => {
  const existing = await db.orm.public.UseMedia.where({ id }).first();
  if (!existing) {
    throw new AppError("UseMedia record not found", 404);
  }

  if (
    user.role !== USER_ROLES.ADMIN &&
    existing.userId !== user.id &&
    (!user.sellerId || existing.sellerId !== user.sellerId)
  ) {
    throw new AppError("Forbidden: You do not have permission to modify this media configuration", 403);
  }

  const updateData: any = {};
  if (payload.alt !== undefined) updateData.alt = payload.alt;
  if (payload.description !== undefined) updateData.description = payload.description;

  const updated = await db.orm.public.UseMedia.where({ id }).update(updateData);
  const media = await db.orm.public.Media.where({ id: existing.mediaId }).first();

  return {
    ...updated,
    media,
  };
};

/**
 * Delete a UseMedia configuration
 */
export const deleteUseMedia = async (
  id: number,
  user: { id: number; role: string; sellerId?: number | null }
) => {
  const existing = await db.orm.public.UseMedia.where({ id }).first();
  if (!existing) {
    throw new AppError("UseMedia record not found", 404);
  }

  if (
    user.role !== USER_ROLES.ADMIN &&
    existing.userId !== user.id &&
    (!user.sellerId || existing.sellerId !== user.sellerId)
  ) {
    throw new AppError("Forbidden: You do not have permission to delete this media configuration", 403);
  }

  await db.orm.public.UseMedia.where({ id }).delete();
  return { message: "UseMedia record deleted successfully", id };
};

/**
 * Convenience method: Direct Upload + Auto UseMedia creation
 * Uploads buffer to Cloudinary -> saves Media -> creates UseMedia in one request
 */
export const uploadAndCreateUseMedia = async (
  file: Express.Multer.File,
  user: { id: number; role: string; sellerId?: number | null },
  payload: { alt?: string; description?: string; folder?: string }
) => {
  // 1. Upload raw image to Media
  const media = await uploadSingleMedia(file, user, payload.folder);

  // 2. Create UseMedia configuration
  const useMedia = await createUseMedia(user, {
    mediaId: media.id,
    alt: payload.alt,
    description: payload.description,
  });

  return useMedia;
};
