import express, { type Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import { ENV } from "./config/env.ts";
import { ApplicationRoutes } from "./routes/index.ts";
import { notFoundHandler, globalErrorHandler } from "./errors/errorHandler.ts";
import { db } from "./config/db.ts";
import { firstRow } from "./utils/rawQuery.ts";
import { apiLimiter, authLimiter, orderLimiter } from "./middlewares/rateLimit.ts";

const app: Application = express();

app.disable("x-powered-by");
// Behind Nginx / a load balancer: trust X-Forwarded-For so rate limits see real client IPs
app.set("trust proxy", ENV.TRUST_PROXY);

/**
 * Standard Middlewares
 */
// Pure JSON API: helmet's defaults (incl. a locked-down CSP) are safe here
app.use(helmet());

const allowedOrigins = new Set(
  ENV.NODE_ENV === "production"
    ? [ENV.CLIENT_URL, ...ENV.CORS_ORIGINS]
    : [ENV.CLIENT_URL, ...ENV.CORS_ORIGINS, "http://localhost:3000", "http://localhost:3001"]
);
app.use(
  cors({
    origin: [...allowedOrigins],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Session-Id"],
  })
);

app.use(compression());
app.use(cookieParser());
// Files go through multer (multipart); JSON bodies only need room for long product descriptions
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Request logging: colourful in development, one line per request (with response time) in production
app.use(
  morgan(ENV.NODE_ENV === "development" ? "dev" : ":remote-addr :method :url :status :res[content-length] - :response-time ms", {
    skip: (req) => req.path === "/api/health",
  })
);

/**
 * Base Health Check API (used by load balancers / uptime monitors)
 */
app.get("/api/health", async (_req, res) => {
  try {
    await firstRow(db.raw.sql`SELECT 1 AS ok`.returnsRow({ ok: "pg/int4@1" }).build());
    res.status(200).json({ status: "HEALTHY", timestamp: new Date().toISOString(), database: "up" });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(503).json({ status: "UNHEALTHY", timestamp: new Date().toISOString(), database: "down" });
  }
});

/**
 * Rate limits, then all modular application routes
 */
app.use("/api/v1", apiLimiter);
app.use(["/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/change-password"], authLimiter);
app.use(["/api/v1/orders/checkout", "/api/v1/orders/detail"], orderLimiter);
app.use("/api/v1", ApplicationRoutes);

/**
 * Root Welcome
 */
app.get("/", (_req, res) => {
  res.json({
    message: "Welcome to Shopora Hybrid Multi-Vendor E-Commerce Platform API",
    version: "v1.0.0",
    healthCheck: "/api/health",
    apiDocumentation: "/api/v1",
  });
});

/**
 * Error Handling Middlewares
 */
app.use(notFoundHandler);
app.use(globalErrorHandler);

/**
 * Start Express HTTP Server
 */
const server = app.listen(ENV.PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Shopora E-Commerce Backend Server Live`);
  console.log(`🌐 Server URL: http://localhost:${ENV.PORT}`);
  console.log(`📡 Health Check: http://localhost:${ENV.PORT}/api/health`);
  console.log(`⚙️  Environment: ${ENV.NODE_ENV}`);
  console.log(`======================================================\n`);
});

/**
 * Graceful Process Teardown
 */
let shuttingDown = false;
const shutdown = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\nInitiating graceful shutdown...");

  // Don't hang forever on keep-alive sockets or stuck queries
  setTimeout(() => {
    console.error("Graceful shutdown timed out, forcing exit.");
    process.exit(1);
  }, 10_000).unref();

  server.close(async () => {
    console.log("HTTP server closed.");
    try {
      await db.close();
      console.log("Database connection pool terminated.");
    } catch (e) {
      console.error("Error closing database:", e);
    }
    process.exit(exitCode);
  });
  server.closeIdleConnections();
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  // Process state is unknown after this; log, drain and let the supervisor restart us
  console.error("Uncaught exception:", err);
  shutdown(1);
});

export default app;
