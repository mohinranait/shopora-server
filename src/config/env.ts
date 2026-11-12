import "dotenv/config";

const NODE_ENV = process.env.NODE_ENV || "production";
const isProduction = NODE_ENV === "production";

/**
 * Read a required variable. Dev-only fallbacks keep local setup easy, but
 * production refuses to boot without the real value.
 */
const required = (key: string, devFallback?: string): string => {
  const value = process.env[key];
  if (value) return value;
  if (!isProduction && devFallback !== undefined) return devFallback;
  throw new Error(`Missing required environment variable: ${key}`);
};

/**
 * Validated Environment Variables configuration for Shopora Backend
 */
export const ENV = {
  NODE_ENV,
  PORT: Number(process.env.PORT) || 5000,
  DATABASE_URL: required("DATABASE_URL"),
  
  // JWT Configuration
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET", "dev_only_access_secret"),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "7d",
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", "dev_only_refresh_secret"),
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  
  // Default Platform Business Settings
  DEFAULT_COMMISSION_RATE: Number(process.env.DEFAULT_COMMISSION_RATE) || 10.0, // 10% default platform commission
  CLIENT_URL: required("CLIENT_URL", "http://localhost:3000"),
  // Extra allowed CORS origins, comma separated (e.g. admin or preview domains)
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean),
  // Number of reverse proxies in front of the app (Nginx, load balancer). Needed for real client IPs.
  TRUST_PROXY: Number(process.env.TRUST_PROXY ?? (isProduction ? 1 : 0)),
  // How often matured escrow is released to seller balances, in minutes (0 disables the job)
  ESCROW_RELEASE_INTERVAL_MINUTES: Number(process.env.ESCROW_RELEASE_INTERVAL_MINUTES ?? 60),

  // Cloudinary Image Storage Configuration
  cloudinary_name: process.env.CLOUDINARY_NAME || process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinary_key: process.env.CLOUDINARY_KEY || process.env.CLOUDINARY_API_KEY || "",
  cloudinary_SECRET: process.env.CLOUDINARY_SECRET || process.env.CLOUDINARY_API_SECRET || "",
  cloudinary_folder: process.env.CLOUDINARY_FOLDER || "shopora",
} as const;

if (isProduction) {
  if (ENV.JWT_ACCESS_SECRET.length < 32 || ENV.JWT_REFRESH_SECRET.length < 32) {
    throw new Error("JWT secrets must be at least 32 characters in production");
  }
  if (ENV.JWT_ACCESS_SECRET === ENV.JWT_REFRESH_SECRET) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
  }
}
