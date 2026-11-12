import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "./AppError.ts";
import { ENV } from "../config/env.ts";

/**
 * Handle 404 Route Not Found
 */
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({
    success: false,
    message: `API Route not found: [${req.method}] ${req.originalUrl}`,
    errorMessages: [
      {
        path: req.originalUrl,
        message: "Requested API endpoint does not exist",
      },
    ],
  });
};

/**
 * Global Centralized Error Handling Middleware
 */
export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = 500;
  let message = "Something went wrong on the server!";
  let errorSources: { path: string | number; message: string }[] = [];

  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    statusCode = 400;
    message = "Input Validation Failed";
    errorSources = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  }
  // 2. Custom Application Operational Errors
  else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorSources = [
      {
        path: "",
        message: err.message,
      },
    ];
  }
  // 3. PostgreSQL / Prisma Unique Constraint or Foreign Key Errors
  else if (err?.code === "23505" || err?.message?.includes("unique constraint")) {
    statusCode = 409;
    message = "Duplicate Key Error: Record already exists with unique value.";
    errorSources = [
      {
        path: "",
        message: "A record with the same unique value already exists.",
      },
    ];
  }
  // 4. Multer Upload Errors
  else if (err?.name === "MulterError") {
    statusCode = 400;
    message = err.code === "LIMIT_FILE_SIZE" ? "File size exceeds maximum allowed limit (15MB)" : (err.message || "File upload failed");
    errorSources = [
      {
        path: err.field || "file",
        message,
      },
    ];
  }
  // 5. Client errors raised by body-parser etc. (malformed JSON, payload too large)
  else if (typeof err?.status === "number" && err.status >= 400 && err.status < 500) {
    statusCode = err.status;
    message = err.expose ? err.message : "Bad request";
    errorSources = [{ path: "", message }];
  }
  // 6. Standard JS Error
  else if (err instanceof Error) {
    message = err.message;
    errorSources = [
      {
        path: "",
        message: err.message,
      },
    ];
  }

  const isDev = ENV.NODE_ENV === "development";

  // Unexpected errors: log server-side, never leak internals (SQL, stack, paths) to clients
  if (statusCode >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    if (!isDev) {
      message = "Something went wrong on the server!";
      errorSources = [];
    }
  }

  // Send structured JSON error response
  res.status(statusCode).json({
    success: false,
    message,
    errorSources: errorSources.length > 0 ? errorSources : undefined,
    stack: isDev ? err?.stack : undefined,
  });
};
