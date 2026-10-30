import "dotenv/config";

/**
 * Validated Environment Variables configuration for Shopora Backend
 */
export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT) || 5000,
  DATABASE_URL: process.env.DATABASE_URL || "",
  
  // JWT Configuration
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "shopora_super_secure_access_secret_key_2026",
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "7d",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "shopora_super_secure_refresh_secret_key_2026",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  
  // Default Platform Business Settings
  DEFAULT_COMMISSION_RATE: Number(process.env.DEFAULT_COMMISSION_RATE) || 10.0, // 10% default platform commission
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",

  // Cloudinary Image Storage Configuration
  cloudinary_name: process.env.CLOUDINARY_NAME || process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinary_key: process.env.CLOUDINARY_KEY || process.env.CLOUDINARY_API_KEY || "",
  cloudinary_SECRET: process.env.CLOUDINARY_SECRET || process.env.CLOUDINARY_API_SECRET || "",
  cloudinary_folder: process.env.CLOUDINARY_FOLDER || "shopora",
} as const;
