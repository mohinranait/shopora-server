import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError.ts";
import { verifyAccessToken, decodeToken, type IJwtUserPayload } from "../utils/token.ts";
import { db } from "../config/db.ts";
import { ENV } from "../config/env.ts";
import { USER_ROLES } from "../constants/index.ts";

// Extend Express Request interface to include user payload
declare global {
  namespace Express {
    interface Request {
      user?: IJwtUserPayload;
    }
  }
}

/**
 * Authentication & Role Guard Middleware
 * @param allowedRoles List of roles permitted to access the route
 */
export const authGuard = (...allowedRoles: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        if (ENV.NODE_ENV === "development") {
          const defaultAdmin = await db.orm.public.User.where({ role: USER_ROLES.ADMIN }).first();
          if (defaultAdmin) {
            req.user = {
              id: defaultAdmin.id,
              email: defaultAdmin.email,
              role: defaultAdmin.role,
              sellerId: null,
            };
            if (allowedRoles.length === 0 || allowedRoles.includes(defaultAdmin.role)) {
              return next();
            }
          }
        }
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
      } catch (err: any) {
        if (ENV.NODE_ENV === "development") {
          // In development mode, recover gracefully from expired/stale tokens
          const unverified = decodeToken(token);
          if (unverified?.id) {
            const devUser = await db.orm.public.User.where({ id: unverified.id, isActive: true }).first();
            if (devUser && (allowedRoles.length === 0 || allowedRoles.includes(devUser.role))) {
              let sellerId = null;
              if (devUser.role === USER_ROLES.SELLER) {
                const sp = await db.orm.public.SellerProfile.where({ userId: devUser.id }).first();
                sellerId = sp ? sp.id : null;
              }
              req.user = {
                id: devUser.id,
                email: devUser.email,
                role: devUser.role,
                sellerId,
              };
              return next();
            }
          }

          // Fallback to active admin in development
          const defaultAdmin = await db.orm.public.User.where({ role: USER_ROLES.ADMIN, isActive: true }).first();
          if (defaultAdmin && (allowedRoles.length === 0 || allowedRoles.includes(defaultAdmin.role))) {
            req.user = {
              id: defaultAdmin.id,
              email: defaultAdmin.email,
              role: defaultAdmin.role,
              sellerId: null,
            };
            return next();
          }
        }
        throw new AppError("Invalid or expired authentication token", 401);
      }

      // Check if user still exists and is active
      const user = await db.orm.public.User.where({ id: decoded.id }).first();
      if (!user) {
        throw new AppError("User account no longer exists", 401);
      }

      if (!user.isActive) {
        throw new AppError("Your account has been deactivated. Please contact support.", 403);
      }

      // Attach sellerId if user is a seller
      if (user.role === "SELLER") {
        const sellerProfile = await db.orm.public.SellerProfile.where({ userId: user.id }).first();
        decoded.sellerId = sellerProfile ? sellerProfile.id : null;
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
            const user = await db.orm.public.User.where({ id: decoded.id }).first();
            if (user && user.isActive) {
              if (user.role === "SELLER") {
                const sellerProfile = await db.orm.public.SellerProfile.where({ userId: user.id }).first();
                decoded.sellerId = sellerProfile ? sellerProfile.id : null;
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

