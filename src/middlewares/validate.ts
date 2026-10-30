import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

/**
 * Validate incoming request with Zod schema
 */
export const validateRequest = (schema: ZodType) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Replace body with sanitized/validated data
      if ((parsed as any).body) {
        req.body = (parsed as any).body;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
