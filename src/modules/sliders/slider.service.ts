import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";

/**
 * Helper: Populate slider media
 */
const populateSliderMedia = async (slider: any) => {
  let useMedia: any = null;
  const targetImageId = slider.imageId ?? slider.useMediaId;
  if (targetImageId) {
    const um = await db.orm.public.UseMedia.where({ id: targetImageId }).first();
    if (um) {
      const m = await db.orm.public.Media.where({ id: um.mediaId }).first();
      useMedia = { ...um, media: m };
    }
  }

  let mobileUseMedia: any = null;
  const targetMobileImageId = slider.mobileImageId ?? slider.mobileUseMediaId;
  if (targetMobileImageId) {
    const mum = await db.orm.public.UseMedia.where({ id: targetMobileImageId }).first();
    if (mum) {
      const mm = await db.orm.public.Media.where({ id: mum.mediaId }).first();
      mobileUseMedia = { ...mum, media: mm };
    }
  }

  return {
    ...slider,
    imageId: slider.imageId ?? targetImageId ?? null,
    mobileImageId: slider.mobileImageId ?? targetMobileImageId ?? null,
    useMedia,
    mobileUseMedia,
    image: useMedia,
    mobileImage: mobileUseMedia,
    imageUrl: useMedia?.media?.url ?? null,
    mobileImageUrl: mobileUseMedia?.media?.url ?? null,
  };
};

export const getSliders = async (includeInactive = false) => {
  let query = db.orm.public.Slider;
  let rows;
  if (!includeInactive) {
    rows = await query.where({ isActive: true }).orderBy((s) => s.displayOrder.asc()).all();
  } else {
    rows = await query.orderBy((s) => s.displayOrder.asc()).all();
  }

  return await Promise.all(rows.map((slider) => populateSliderMedia(slider)));
};

export const getSliderById = async (id: string) => {
  const slider = await db.orm.public.Slider.where({ id }).first();
  if (!slider) {
    throw new AppError("Slider not found", 404);
  }
  return await populateSliderMedia(slider);
};

export const createSlider = async (payload: any) => {
  const slider = await db.orm.public.Slider.create({
    type: payload.type || "IMAGE_BG_CONTENT",
    title: payload.title ?? null,
    subtitle: payload.subtitle ?? null,
    description: payload.description ?? null,
    badgeText: payload.badgeText ?? null,
    imageId: payload.imageId ?? payload.useMediaId ?? null,
    mobileImageId: payload.mobileImageId ?? payload.mobileUseMediaId ?? null,
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

  return await populateSliderMedia(slider);
};

export const updateSlider = async (id: string, payload: any) => {
  const existing = await db.orm.public.Slider.where({ id }).first();
  if (!existing) {
    throw new AppError("Slider not found", 404);
  }

  const updateData: any = {};
  if (payload.type !== undefined) updateData.type = payload.type;
  if (payload.title !== undefined) updateData.title = payload.title;
  if (payload.subtitle !== undefined) updateData.subtitle = payload.subtitle;
  if (payload.description !== undefined) updateData.description = payload.description;
  if (payload.badgeText !== undefined) updateData.badgeText = payload.badgeText;
  if (payload.imageId !== undefined || payload.useMediaId !== undefined) {
    updateData.imageId = payload.imageId !== undefined ? payload.imageId : payload.useMediaId;
  }
  if (payload.mobileImageId !== undefined || payload.mobileUseMediaId !== undefined) {
    updateData.mobileImageId = payload.mobileImageId !== undefined ? payload.mobileImageId : payload.mobileUseMediaId;
  }
  if (payload.linkUrl !== undefined) updateData.linkUrl = payload.linkUrl;
  if (payload.buttonText !== undefined) updateData.buttonText = payload.buttonText;
  if (payload.bgGradient !== undefined) updateData.bgGradient = payload.bgGradient;
  if (payload.bgColor !== undefined) updateData.bgColor = payload.bgColor;
  if (payload.textColor !== undefined) updateData.textColor = payload.textColor;
  if (payload.displayOrder !== undefined) updateData.displayOrder = payload.displayOrder;
  if (payload.isActive !== undefined) updateData.isActive = payload.isActive;
  if (payload.startDate !== undefined) updateData.startDate = payload.startDate;
  if (payload.endDate !== undefined) updateData.endDate = payload.endDate;

  const updated = await db.orm.public.Slider.where({ id }).update(updateData);
  return await populateSliderMedia(updated);
};

export const deleteSlider = async (id: string) => {
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
