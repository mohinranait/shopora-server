import express, { type Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { ENV } from "./config/env.ts";
import { ApplicationRoutes } from "./routes/index.ts";
import { notFoundHandler, globalErrorHandler } from "./errors/errorHandler.ts";
import { db } from "./config/db.ts";

const app: Application = express();

/**
 * Standard Middlewares
 */
app.use(
  cors({
    origin: [ENV.CLIENT_URL, "http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Session-Id"],
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

if (ENV.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

/**
 * Base Health Check API
 */
app.get("/api/health", async (_req, res) => {
  try {
    const userCount = await db.orm.public.User.aggregate((a) => ({
      total: a.count(),
    }));

    res.status(200).json({
      status: "HEALTHY",
      platform: "Shopora Hybrid Multi-Vendor Platform API",
      environment: ENV.NODE_ENV,
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        totalUsersRegistered: userCount.total,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      status: "UNHEALTHY",
      error: err.message,
    });
  }
});

/**
 * Mount All Modular Application Routes
 */
app.use("/api/v1", ApplicationRoutes);
app.use("/api", ApplicationRoutes);

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
const shutdown = async () => {
  console.log("\nInitiating graceful shutdown...");
  server.close(async () => {
    console.log("HTTP server closed.");
    try {
      await db.close();
      console.log("Database connection pool terminated.");
    } catch (e) {
      console.error("Error closing database:", e);
    }
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
