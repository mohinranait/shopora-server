import { rateLimit } from "express-rate-limit";

/**
 * Per-IP request limits. The default store is in-memory, so limits are per process;
 * when running several instances behind a load balancer, switch to a shared store (e.g. Redis).
 */
const limiter = (windowMinutes: number, limit: number, message: string) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message },
  });

/** Whole API: generous ceiling against scraping and floods */
export const apiLimiter = limiter(1, 300, "Too many requests. Please slow down and try again shortly.");

/** Login / registration / password change: blocks credential brute forcing */
export const authLimiter = limiter(15, 20, "Too many attempts. Please wait 15 minutes and try again.");

/** Guest checkout and order lookup by number + phone: blocks spam orders and enumeration */
export const orderLimiter = limiter(10, 30, "Too many order requests. Please wait a few minutes and try again.");
