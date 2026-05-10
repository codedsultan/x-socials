import { describe, it, expect, vi } from "vitest";
import express, { Application } from "express";
import request from "supertest";
import ExceptionHandler from "./Handler";
import ApiError from "./ApiError";

// ------ mocks ------
vi.mock("../logger", () => ({
  default: {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      http: vi.fn(),
    })),
  },
}));

vi.mock("../config/env", () => ({
  default: {
    getConfig: vi.fn(() => ({
      PORT: 5000,
      NODE_ENV: "test",
      SERVER_MAINTENANCE: false,
      API_PREFIX: "api",
    })),
    isProduction: vi.fn(() => false),
    isDevelopment: vi.fn(() => false),
    isTest: vi.fn(() => true),
    isServerMaintenance: vi.fn(() => false),
    getApiUrl: vi.fn(() => "http://localhost:5000"),
    isSwaggerEnabled: vi.fn(() => false),
    init: vi.fn(),
  },
}));

// ------ helpers ------
function buildApp(): Application {
  const app = express();
  app.use(express.json());
  return app;
}

// ------ notFoundHandler ------
describe("ExceptionHandler.notFoundHandler", () => {
  it("should return 200 JSON for root '/' path", async () => {
    const app = buildApp();
    ExceptionHandler.notFoundHandler(app);

    const res = await request(app).get("/").expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.server).toBe("online");
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("should return 404 for unknown paths", async () => {
    const app = buildApp();
    ExceptionHandler.notFoundHandler(app);

    const res = await request(app).get("/unknown/route").expect(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Path not found");
    expect(res.body.method).toBe("GET");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("should return 404 for any HTTP method on unknown routes", async () => {
    const app = buildApp();
    ExceptionHandler.notFoundHandler(app);

    const res = await request(app).post("/nonexistent").expect(404);
    expect(res.body.method).toBe("POST");
    expect(res.body.success).toBe(false);
  });

  it("should return the application from notFoundHandler", () => {
    const app = buildApp();
    const result = ExceptionHandler.notFoundHandler(app);
    expect(result).toBe(app);
  });
});

// ------ logErrors ------
describe("ExceptionHandler.logErrors", () => {
  it("should call next with the error after logging", async () => {
    const app = buildApp();
    app.get("/throw", () => {
      throw new Error("boom");
    });
    // Attach logErrors then a final error absorber
    app.use(ExceptionHandler.logErrors);
    app.use(
      (err: any, _req: any, res: any, _next: any) => {
        res.status(500).json({ caught: true, message: err.message });
      }
    );

    const res = await request(app).get("/throw").expect(500);
    expect(res.body.caught).toBe(true);
    expect(res.body.message).toBe("boom");
  });
});

// ------ clientErrorHandler ------
describe("ExceptionHandler.clientErrorHandler", () => {
  it("should forward non-XHR errors to next()", async () => {
    const app = buildApp();
    app.get("/error", (_req, _res, next) => {
      next(new Error("client error"));
    });
    app.use(ExceptionHandler.clientErrorHandler);
    app.use(
      (err: any, _req: any, res: any, _next: any) => {
        res.status(500).json({ forwarded: true, msg: err.message });
      }
    );

    const res = await request(app).get("/error").expect(500);
    expect(res.body.forwarded).toBe(true);
    expect(res.body.msg).toBe("client error");
  });

  it("should respond 500 JSON for XHR requests", async () => {
    const app = buildApp();
    app.get("/error", (_req, _res, next) => {
      next(new Error("xhr error"));
    });
    app.use(ExceptionHandler.clientErrorHandler);

    const res = await request(app)
      .get("/error")
      .set("X-Requested-With", "XMLHttpRequest")
      .expect(500);

    expect(res.body.error).toBe("Something went wrong!");
  });
});

// ------ errorHandler ------
describe("ExceptionHandler.errorHandler", () => {
  it("should return ApiError status and message for API routes", async () => {
    const app = buildApp();
    app.get("/api/protected", (_req, _res, next) => {
      next(new ApiError("Unauthorized access", 401));
    });
    app.use(ExceptionHandler.errorHandler);

    const res = await request(app).get("/api/protected").expect(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("Unauthorized access");
  });

  it("should handle UnauthorizedError name on API routes", async () => {
    const app = buildApp();
    app.get("/api/secured", (_req, _res, next) => {
      const err: any = new ApiError("token invalid", 400);
      err.name = "UnauthorizedError";
      next(err);
    });
    app.use(ExceptionHandler.errorHandler);

    const res = await request(app).get("/api/secured").expect(401);
    expect(res.body.success).toBe(false);
  });

  it("should handle CastError name on API routes as 404", async () => {
    const app = buildApp();
    app.get("/api/resource/bad-id", (_req, _res, next) => {
      const err: any = new ApiError("cast error", 500);
      err.name = "CastError";
      next(err);
    });
    app.use(ExceptionHandler.errorHandler);

    const res = await request(app)
      .get("/api/resource/bad-id")
      .expect(404);
    expect(res.body.success).toBe(false);
  });

  it("should handle jsonWebTokenError name as 401", async () => {
    const app = buildApp();
    app.get("/api/me", (_req, _res, next) => {
      const err: any = new ApiError("jwt bad", 500);
      err.name = "jsonWebTokenError";
      next(err);
    });
    app.use(ExceptionHandler.errorHandler);

    const res = await request(app).get("/api/me").expect(401);
    expect(res.body.success).toBe(false);
  });

  it("should handle TokenExpiredError name as 401", async () => {
    const app = buildApp();
    app.get("/api/refresh", (_req, _res, next) => {
      const err: any = new ApiError("expired", 500);
      err.name = "TokenExpiredError";
      next(err);
    });
    app.use(ExceptionHandler.errorHandler);

    const res = await request(app).get("/api/refresh").expect(401);
    expect(res.body.success).toBe(false);
  });

  it("should default to 500 when no statusCode is set", async () => {
    const app = buildApp();
    app.get("/api/boom", (_req, _res, next) => {
      const err: any = new Error("generic");
      next(err);
    });
    app.use(ExceptionHandler.errorHandler);

    const res = await request(app).get("/api/boom").expect(500);
    expect(res.body.success).toBe(false);
  });
});
