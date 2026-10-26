import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";

export const getSliders = async (includeInactive = false) => {
  let query = db.orm.public.Slider;
  let rows;
  if (!includeInactive) {
    rows = await query.where({ isActive: true }).orderBy((s) => s.displayOrder.asc()).all();
  } else {
    rows = await query.orderBy((s) => s.displayOrder.asc()).all();
  }

  // Populate useMedia with media if present
  return await Promise.all(
    rows.map(async (slider) => {
      let useMedia: any = null;
      if (slider.useMediaId) {
        const um = await db.orm.public.UseMedia.where({ id: slider.useMediaId }).first();
        if (um) {
          const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
          useMedia = { ...um, media: m };
        }
      }
      return { ...slider, useMedia };
    })
  );
};

export const getSliderById = async (id: number) => {
  const slider = await db.orm.public.Slider.where({ id }).first();
  if (!slider) {
    throw new AppError("Slider not found", 404);
  }
  let useMedia: any = null;
  if (slider.useMediaId) {
    const um = await db.orm.public.UseMedia.where({ id: slider.useMediaId }).first();
    if (um) {
      const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
      useMedia = { ...um, media: m };
    }
  }
  return { ...slider, useMedia };
};

export const createSlider = async (payload: any) => {
  let imageUrl = payload.imageUrl || null;
  const useMediaId = payload.useMediaId ?? null;

  if (useMediaId && !imageUrl) {
    const useMedia = await db.orm.public.UseMedia.where({ id: useMediaId }).first();
    if (useMedia) {
      const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
      if (media) imageUrl = media.url;
    }
  }

  return await db.orm.public.Slider.create({
    type: payload.type || "IMAGE_BG_CONTENT",
    title: payload.title ?? null,
    subtitle: payload.subtitle ?? null,
    description: payload.description ?? null,
    badgeText: payload.badgeText ?? null,
    imageUrl,
    mobileImageUrl: payload.mobileImageUrl ?? null,
    useMediaId,
    linkUrl: payload.linkUrl ?? null,
    buttonText: payload.buttonText ?? "Shop Now",
    bgGradient: payload.bgGradient ?? null,
    bgColor: payload.bgColor ?? null,
    textColor: payload.textColor || "LIGHT",
    displayOrder: payload.displayOrder ?? 0,
    isActive: payload.isActive !== false,
    startDate: payload.startDate ?? null,
    endDate: payload.endDate ?? null,
  });
};

export const updateSlider = async (id: number, payload: any) => {
  const existing = await db.orm.public.Slider.where({ id }).first();
  if (!existing) {
    throw new AppError("Slider not found", 404);
  }

  let imageUrl = payload.imageUrl !== undefined ? payload.imageUrl : existing.imageUrl;
  const useMediaId = payload.useMediaId !== undefined ? payload.useMediaId : existing.useMediaId;

  if (useMediaId && !imageUrl) {
    const useMedia = await db.orm.public.UseMedia.where({ id: useMediaId }).first();
    if (useMedia) {
      const media = await db.orm.public.Media.where({ id: useMedia.mediaId }).first();
      if (media) imageUrl = media.url;
    }
  }

  return await db.orm.public.Slider.where({ id }).update({
    type: payload.type !== undefined ? payload.type : existing.type,
    title: payload.title !== undefined ? payload.title : existing.title,
    subtitle: payload.subtitle !== undefined ? payload.subtitle : existing.subtitle,
    description: payload.description !== undefined ? payload.description : existing.description,
    badgeText: payload.badgeText !== undefined ? payload.badgeText : existing.badgeText,
    imageUrl,
    mobileImageUrl: payload.mobileImageUrl !== undefined ? payload.mobileImageUrl : existing.mobileImageUrl,
    useMediaId,
    linkUrl: payload.linkUrl !== undefined ? payload.linkUrl : existing.linkUrl,
    buttonText: payload.buttonText !== undefined ? payload.buttonText : existing.buttonText,
    bgGradient: payload.bgGradient !== undefined ? payload.bgGradient : existing.bgGradient,
    bgColor: payload.bgColor !== undefined ? payload.bgColor : existing.bgColor,
    textColor: payload.textColor !== undefined ? payload.textColor : existing.textColor,
    displayOrder: payload.displayOrder !== undefined ? payload.displayOrder : existing.displayOrder,
    isActive: payload.isActive !== undefined ? payload.isActive : existing.isActive,
    startDate: payload.startDate !== undefined ? payload.startDate : existing.startDate,
    endDate: payload.endDate !== undefined ? payload.endDate : existing.endDate,
  });
};

export const deleteSlider = async (id: number) => {
  const existing = await db.orm.public.Slider.where({ id }).first();
  if (!existing) {
    throw new AppError("Slider not found", 404);
  }
  return await db.orm.public.Slider.where({ id }).delete();
};

export const SliderService = {
  getSliders,
  getSliderById,
  createSlider,
  updateSlider,
  deleteSlider,
};
