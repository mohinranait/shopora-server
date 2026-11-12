import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError.ts";
import { verifyAccessToken, type IJwtUserPayload } from "../utils/token.ts";
import { db } from "../config/db.ts";

// Extend Express Request interface to include user payload
declare global {
  namespace Express {
    interface Request {
      user?: IJwtUserPayload;
    }
  }
}

/** Fetch only what auth needs: role/active flags plus the seller profile id, in one query */
const loadAuthUser = (id: string) =>
  db.orm.public.User.where({ id })
    .select("id", "role", "isActive")
    .include("sellerProfile", (sp) => sp.select("id"))
    .first();

/**
 * Authentication & Role Guard Middleware
 * @param allowedRoles List of roles permitted to access the route
 */
export const authGuard = (...allowedRoles: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new AppError("Authentication required: No bearer token provided", 401);
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        throw new AppError("Authentication token is missing", 401);
      }

      // Verify token
      let decoded: IJwtUserPayload;
      try {
        decoded = verifyAccessToken(token);
      } catch {
        throw new AppError("Invalid or expired authentication token", 401);
      }

      // Check if user still exists and is active (seller profile joined in the same query)
      const user = await loadAuthUser(decoded.id);
      if (!user) {
        throw new AppError("User account no longer exists", 401);
      }

      if (!user.isActive) {
        throw new AppError("Your account has been deactivated. Please contact support.", 403);
      }

      // Attach sellerId if user is a seller
      if (user.role === "SELLER") {
        decoded.sellerId = user.sellerProfile?.id ?? null;
      }

      // Check role authorization
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        throw new AppError(
          `Forbidden: You do not have permission to perform this action. Required role: [${allowedRoles.join(", ")}]`,
          403
        );
      }

      // Set user on request
      req.user = decoded;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Optional Authentication Middleware (For routes that support both guest and logged-in users)
 */
export const optionalAuth = () => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        if (token) {
          try {
            const decoded = verifyAccessToken(token);
            const user = await loadAuthUser(decoded.id);
            if (user && user.isActive) {
              if (user.role === "SELLER") {
                decoded.sellerId = user.sellerProfile?.id ?? null;
              }
              req.user = decoded;
            }
          } catch {
            // Ignore token verification errors for optional auth
          }
        }
      }
      next();
    } catch {
      next();
    }
  };
};

