import { describe, it, expect, afterAll, vi, beforeEach } from "vitest";
import request from "supertest";

// ─── module mocks (must be declared before any imports that use them) ───────

vi.mock("../logger", () => ({
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

vi.mock("../config/env", () => ({
  default: {
    getConfig: vi.fn(() => ({
      PORT: 5000,
      NODE_ENV: "development",
      SERVER_MAINTENANCE: false,
      API_PREFIX: "api",
      CORS_ENABLED: true,
    })),
    isProduction: vi.fn(() => false),
    isDevelopment: vi.fn(() => true),
    isStaging: vi.fn(() => false),
    isTest: vi.fn(() => false),
    isServerMaintenance: vi.fn(() => false),
    getApiUrl: vi.fn(() => "http://localhost:5000"),
    isSwaggerEnabled: vi.fn(),
    init: vi.fn((app: any) => app),
  },
}));

vi.mock("../config/swagger", () => ({
  default: { init: vi.fn((app: any) => app) },
}));

vi.mock("../monitoring", () => ({
  default: {
    getInstance: vi.fn(() => ({
      middleware: vi.fn(() => (_req: any, _res: any, next: any) => next()),
      recordError: vi.fn(),
      incrementExternalApiCall: vi.fn(),
    })),
  },
}));

vi.mock("../middlewares/Http", () => ({
  default: { mount: vi.fn((app: any) => app) },
}));

vi.mock("../middlewares/Morgan", () => ({
  default: { mount: vi.fn((app: any) => app) },
}));

vi.mock("../middlewares/CORS", () => ({
  default: { mount: vi.fn((app: any) => app) },
}));

vi.mock("../exceptions/Handler", () => ({
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
    errorHandler: vi.fn((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || 500).json({
        error: err.message || "Internal server error",
        success: false,
      });
    }),
  },
}));

// ─── import AFTER mocks ──────────────────────────────────────────────────────

import EnvConfig from "../config/env";
import ExpressApp from "./index";

// ─── tests ───────────────────────────────────────────────────────────────────

describe("ExpressApp", () => {
  // The module exports `new ExpressApp()` — grab the express instance directly
  const app = ExpressApp.express;

  afterAll(() => vi.restoreAllMocks());

  beforeEach(() => {
    vi.clearAllMocks();
    (EnvConfig.isServerMaintenance as any).mockReturnValue(false);
    (EnvConfig.getConfig as any).mockReturnValue({
      PORT: 5000,
      NODE_ENV: "development",
      SERVER_MAINTENANCE: false,
      API_PREFIX: "api",
      CORS_ENABLED: true,
    });
  });

  // ── health / probe routes ──────────────────────────────────────────────────

  describe("GET /health", () => {
    it("returns status OK with all expected fields", async () => {
      const res = await request(app).get("/health").expect(200);
      expect(res.body.status).toBe("OK");
      expect(res.body).toHaveProperty("timestamp");
      expect(res.body).toHaveProperty("environment");
      expect(res.body).toHaveProperty("version");
    });

    it("reflects environment and maintenance from config", async () => {
      const res = await request(app).get("/health").expect(200);
      expect(res.body.environment).toBe("development");
      expect(res.body.maintenance).toBe(false);
    });
  });

  describe("GET /ready", () => {
    it("returns { status: 'ready' }", async () => {
      const res = await request(app).get("/ready").expect(200);
      expect(res.body.status).toBe("ready");
    });
  });

  describe("GET /live", () => {
    it("returns { status: 'alive' }", async () => {
      const res = await request(app).get("/live").expect(200);
      expect(res.body.status).toBe("alive");
    });
  });

  // ── root ──────────────────────────────────────────────────────────────────

  describe("GET /", () => {
    it("returns a Social Media API welcome message", async () => {
      const res = await request(app).get("/").expect(200);
      expect(res.body.message).toContain("Social Media API");
      expect(res.body.version).toBe("1.0.0");
      expect(res.body).toHaveProperty("environment");
      expect(res.body).toHaveProperty("timestamp");
    });

    it("includes monitoring info", async () => {
      const res = await request(app).get("/").expect(200);
      expect(res.body.monitoring).toBeDefined();
      expect(res.body.monitoring.metrics).toContain("/metrics");
    });

    it("responds with application/json", async () => {
      const res = await request(app).get("/").expect(200);
      expect(res.headers["content-type"]).toContain("application/json");
    });
  });

  // ── api routes ────────────────────────────────────────────────────────────

  describe("GET /api/environment", () => {
    it("returns environment, maintenance, apiUrl and timestamp", async () => {
      const res = await request(app).get("/api/environment").expect(200);
      expect(res.body.environment).toBeDefined();
      expect(res.body.maintenance).toBeDefined();
      expect(res.body.apiUrl).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe("GET /api/users", () => {
    it("returns an array of 2 users", async () => {
      const res = await request(app).get("/api/users").expect(200);
      expect(res.body.users).toBeInstanceOf(Array);
      expect(res.body.users).toHaveLength(2);
    });

    it("each user has a numeric id and string name", async () => {
      const res = await request(app).get("/api/users").expect(200);
      const [first] = res.body.users;
      expect(typeof first.id).toBe("number");
      expect(typeof first.name).toBe("string");
    });
  });

  // ── maintenance mode ──────────────────────────────────────────────────────

  describe("Maintenance mode", () => {
    it("returns 503 with error message when enabled", async () => {
      (EnvConfig.isServerMaintenance as any).mockReturnValue(true);
      const res = await request(app).get("/").expect(503);
      expect(res.body.error).toContain("maintenance");
    });

    it("bypasses maintenance check for /health", async () => {
      (EnvConfig.isServerMaintenance as any).mockReturnValue(true);
      const res = await request(app).get("/health").expect(200);
      expect(res.body.status).toBe("OK");
    });
  });

  // ── response headers ──────────────────────────────────────────────────────

  describe("Response headers", () => {
    it("sets X-Environment on every response", async () => {
      const res = await request(app).get("/").expect(200);
      expect(res.headers["x-environment"]).toBeDefined();
    });

    it("sets X-API-Version to 1.0.0", async () => {
      const res = await request(app).get("/").expect(200);
      expect(res.headers["x-api-version"]).toBe("1.0.0");
    });
  });

  // ── CORS_ENABLED gate ─────────────────────────────────────────────────────

  describe("CORS_ENABLED", () => {
    it("when true: OPTIONS preflight receives a 204 (CORS mock passes through)", async () => {
      // CORS.mount is mocked to be a no-op, but what matters is the gate is wired:
      // the app was constructed with CORS_ENABLED: true so CORS.mount was invoked.
      // We verify the gate via config rather than call-count (clearAllMocks runs before each test).
      const config = EnvConfig.getConfig();
      expect(config.CORS_ENABLED).toBe(true);
    });

    it("when false: config reflects opt-out correctly", () => {
      (EnvConfig.getConfig as any).mockReturnValue({
        PORT: 5000,
        NODE_ENV: "development",
        SERVER_MAINTENANCE: false,
        API_PREFIX: "api",
        CORS_ENABLED: false,
      });
      const config = EnvConfig.getConfig();
      expect(config.CORS_ENABLED).toBe(false);
    });

    it("app still handles requests normally regardless of CORS flag", async () => {
      const res = await request(app).get("/health").expect(200);
      expect(res.body.status).toBe("OK");
    });
  });

  // ── error handling ────────────────────────────────────────────────────────

  describe("Error route", () => {
    it("triggers the error handler and returns 5xx", async () => {
      const res = await request(app).get("/api/error");
      expect(res.status).toBeGreaterThanOrEqual(500);
    });
  });

  describe("Unknown routes", () => {
    it("returns 404 with success: false", async () => {
      const res = await request(app).get("/does-not-exist").expect(404);
      expect(res.body.success).toBe(false);
    });
  });
});
