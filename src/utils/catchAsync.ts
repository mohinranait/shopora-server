import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Higher-order function to wrap async express route handlers
 * Catches rejected promises and passes them to next(error)
 */
export const catchAsync = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
