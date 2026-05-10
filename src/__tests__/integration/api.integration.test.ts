import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import ExpressApp from "../../app/index";

// Mocks must match what app/index.ts mocks in its own test
vi.mock("../../logger", () => ({
  default: {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      http: vi.fn(),
    })),
    _init: vi.fn(),
  },
}));

vi.mock("../../config/env", () => ({
  default: {
    getConfig: vi.fn(() => ({
      PORT: 5001,
      NODE_ENV: "test",
      SERVER_MAINTENANCE: false,
      API_PREFIX: "api",
      CORS_ENABLED: true,
    })),
    isProduction: vi.fn(() => false),
    isDevelopment: vi.fn(() => false),
    isStaging: vi.fn(() => false),
    isTest: vi.fn(() => true),
    isServerMaintenance: vi.fn(() => false),
    getApiUrl: vi.fn(() => "http://localhost:5001"),
    isSwaggerEnabled: vi.fn(() => false),
    init: vi.fn((app: any) => app),
  },
}));

vi.mock("../../monitoring", () => ({
  default: {
    getInstance: vi.fn(() => ({
      middleware: vi.fn(() => (_req: any, _res: any, next: any) => next()),
      recordError: vi.fn(),
      incrementExternalApiCall: vi.fn(),
    })),
  },
}));

vi.mock("../../config/swagger", () => ({
  default: { init: vi.fn((app: any) => app) },
}));

vi.mock("../../middlewares/Http", () => ({
  default: { mount: vi.fn((app: any) => app) },
}));
vi.mock("../../middlewares/Morgan", () => ({
  default: { mount: vi.fn((app: any) => app) },
}));
vi.mock("../../middlewares/CORS", () => ({
  default: { mount: vi.fn((app: any) => app) },
}));
vi.mock("../../exceptions/Handler", () => ({
  default: {
    notFoundHandler: vi.fn((app: any) => {
      app.use("/{*path}", (_req: any, res: any) =>
        res.status(404).json({ error: "Path not found", success: false })
      );
      return app;
    }),
    logErrors: vi.fn((_err: any, _req: any, _res: any, next: any) => next(_err)),
    clientErrorHandler: vi.fn((err: any, req: any, res: any, next: any) => {
      if (req.xhr) return res.status(500).json({ error: "Something went wrong!" });
      return next(err);
    }),
    errorHandler: vi.fn((err: any, _req: any, res: any, _next: any) =>
      res.status(err.statusCode || 500).json({ error: err.message, success: false })
    ),
  },
}));

describe("API Integration Tests", () => {
  // Module exports `new ExpressApp()` — grab the express instance directly
  const app = ExpressApp.express;

  describe("Full request/response cycle", () => {
    it("should handle multiple sequential requests", async () => {
      const r1 = await request(app).get("/");
      expect(r1.status).toBe(200);

      const r2 = await request(app).get("/health");
      expect(r2.status).toBe(200);

      const r3 = await request(app).get("/api/users");
      expect(r3.status).toBe(200);
    });

    it("should maintain proper content types", async () => {
      const response = await request(app).get("/");
      expect(response.headers["content-type"]).toContain("application/json");
    });

    it("should set environment and version headers on every response", async () => {
      const response = await request(app).get("/health");
      expect(response.headers["x-environment"]).toBeDefined();
      expect(response.headers["x-api-version"]).toBe("1.0.0");
    });

    it("should return 404 for unknown routes via ExceptionHandler", async () => {
      const response = await request(app).get("/totally/unknown/route");
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
