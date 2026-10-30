import { v2 as Cloudinary } from "cloudinary";
import { ENV } from "../config/env.ts";

/**
 * Cloudinary v2 SDK configuration
 */
Cloudinary.config({
  cloud_name: ENV.cloudinary_name,
  api_key: ENV.cloudinary_key,
  api_secret: ENV.cloudinary_SECRET,
  secure: true,
});

export const cloudinary = Cloudinary;
export type { UploadApiResponse, UploadApiErrorResponse } from "cloudinary";
