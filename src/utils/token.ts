import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { ENV } from "../config/env.ts";

export interface IJwtUserPayload {
  id: string;
  email: string;
  role: string;
  sellerId?: string | null;
}

/**
 * Generate Access Token
 */
export const generateAccessToken = (payload: IJwtUserPayload): string => {
  const options: SignOptions = {
    expiresIn: ENV.JWT_ACCESS_EXPIRES_IN as any,
  };
  return jwt.sign(payload, ENV.JWT_ACCESS_SECRET, options);
};

/**
 * Generate Refresh Token
 */
export const generateRefreshToken = (payload: IJwtUserPayload): string => {
  const options: SignOptions = {
    expiresIn: ENV.JWT_REFRESH_EXPIRES_IN as any,
  };
  return jwt.sign(payload, ENV.JWT_REFRESH_SECRET, options);
};

/**
 * Verify Access Token
 */
export const verifyAccessToken = (token: string): IJwtUserPayload => {
  return jwt.verify(token, ENV.JWT_ACCESS_SECRET) as IJwtUserPayload;
};

/**
 * Verify Refresh Token
 */
export const verifyRefreshToken = (token: string): IJwtUserPayload => {
  return jwt.verify(token, ENV.JWT_REFRESH_SECRET) as IJwtUserPayload;
};

/**
 * Decode Token without verification (for payload extraction / fallback)
 */
export const decodeToken = (token: string): IJwtUserPayload | null => {
  try {
    return jwt.decode(token) as IJwtUserPayload | null;
  } catch {
    return null;
  }
};

