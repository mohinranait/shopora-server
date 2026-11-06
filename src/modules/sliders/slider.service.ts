import { db } from "../../config/db.ts";
import { AppError } from "../../errors/AppError.ts";
import type {
  ISliderPopulated,
  ICreateSliderInput,
  IUpdateSliderInput,
} from "./slider.interface.ts";

/**
 * Get all sliders using Prisma 8 native relational include
 */
export const getSliders = async (includeInactive = false): Promise<any[]> => {
  const query = !includeInactive
    ? db.orm.public.Slider.where({ isActive: true })
    : db.orm.public.Slider;

  return await query
    .orderBy((s) => s.displayOrder.asc())
    .include("image", (u) => u.include("media"))
    .include("mobileImage", (u) => u.include("media"))
    .all() as any[];
};

/**
 * Get single slider by ID using native relational include
 */
export const getSliderById = async (id: string): Promise<any> => {
  const slider = await db.orm.public.Slider
    .where({ id })
    .include("image", (u) => u.include("media"))
    .include("mobileImage", (u) => u.include("media"))
    .first();

  if (!slider) {
    throw new AppError("Slider not found", 404);
  }

  return slider;
};

/**
 * Create a new slider
 */
export const createSlider = async (payload: ICreateSliderInput): Promise<ISliderPopulated> => {
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

  return await getSliderById(slider.id);
};

/**
 * Update an existing slider
 */
export const updateSlider = async (
  id: string,
  payload: IUpdateSliderInput
): Promise<ISliderPopulated> => {
  const existing = await db.orm.public.Slider.where({ id }).first();
  if (!existing) {
    throw new AppError("Slider not found", 404);
  }

  const updateData: Record<string, any> = {};
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
  if (!updated) {
    throw new AppError("Slider not found", 404);
  }

  return await getSliderById(updated.id);
};

/**
 * Delete a slider
 */
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
