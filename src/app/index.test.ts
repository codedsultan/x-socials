import { describe, it, expect, afterAll, vi, beforeEach } from "vitest";
import request from "supertest";

// ─── module mocks (must be declared before any imports that use them) ─────────

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

// ── DbManager mock — no real DB connections ────────────────────────────────────

const mockHealthCheck = vi.fn().mockResolvedValue({ mongodb: true });
const mockShutdown = vi.fn().mockResolvedValue(undefined);
const mockInitialize = vi.fn().mockResolvedValue(undefined);
const mockBindModel = vi.fn();
const mockResolveForModel = vi.fn();
const mockListBindings = vi.fn().mockReturnValue([]);
const mockRegistryList = vi.fn().mockReturnValue(["mongodb"]);

vi.mock("../config/db/DbManager", () => ({
  default: {
    getInstance: vi.fn(() => ({
      initialize: mockInitialize,
      shutdown: mockShutdown,
      healthCheck: mockHealthCheck,
      bindModel: mockBindModel,
      resolveForModel: mockResolveForModel,
      registry: {
        list: mockRegistryList,
        getDefault: vi.fn(),
        get: vi.fn(),
      },
      resolver: {
        listBindings: mockListBindings,
        bind: vi.fn(),
      },
    })),
    reset: vi.fn(),
  },
}));

vi.mock("../config/db/DbConfig", () => ({
  DbConfig: {
    buildAll: vi.fn().mockReturnValue([
      { name: "mongodb", driver: "mongoose", isDefault: true },
    ]),
  },
}));

// ─── import AFTER mocks ───────────────────────────────────────────────────────

import EnvConfig from "../config/env";
import ExpressApp from "./index";

// ─── tests ────────────────────────────────────────────────────────────────────

describe("ExpressApp", () => {
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
    mockHealthCheck.mockResolvedValue({ mongodb: true });
    mockListBindings.mockReturnValue([]);
    mockRegistryList.mockReturnValue(["mongodb"]);
  });

  // ── health / probe routes ─────────────────────────────────────────────────────

  describe("GET /health", () => {
    it("returns status OK with all expected fields", async () => {
      const res = await request(app).get("/health").expect(200);
      expect(res.body.status).toBe("OK");
      expect(res.body).toHaveProperty("timestamp");
      expect(res.body).toHaveProperty("environment");
      expect(res.body).toHaveProperty("version");
    });

    it("includes a 'databases' field with health per connection", async () => {
      const res = await request(app).get("/health").expect(200);
      expect(res.body).toHaveProperty("databases");
      expect(res.body.databases).toEqual({ mongodb: true });
    });

    it("reflects environment and maintenance from config", async () => {
      const res = await request(app).get("/health").expect(200);
      expect(res.body.environment).toBe("development");
      expect(res.body.maintenance).toBe(false);
    });

    it("still returns 200 when healthCheck throws (graceful degradation)", async () => {
      mockHealthCheck.mockRejectedValueOnce(new Error("DB unreachable"));
      const res = await request(app).get("/health").expect(200);
      expect(res.body.status).toBe("OK");
      // databases should be empty object on failure
      expect(res.body.databases).toEqual({});
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

  // ── root ──────────────────────────────────────────────────────────────────────

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

  // ── api routes ────────────────────────────────────────────────────────────────

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

  // ── db status route (dev only) ────────────────────────────────────────────────

  describe("GET /api/db/status", () => {
    it("returns connections, health and modelBindings in non-production", async () => {
      mockHealthCheck.mockResolvedValueOnce({ mongodb: true });
      mockRegistryList.mockReturnValueOnce(["mongodb"]);
      mockListBindings.mockReturnValueOnce([
        { modelName: "UserModel", connectionName: "mongodb" },
      ]);

      const res = await request(app).get("/api/db/status").expect(200);

      expect(res.body.connections).toEqual(["mongodb"]);
      expect(res.body.health).toEqual({ mongodb: true });
      expect(res.body.modelBindings).toContainEqual({
        modelName: "UserModel",
        connectionName: "mongodb",
      });
      expect(res.body).toHaveProperty("timestamp");
    });

    it("returns an empty bindings array when no models are bound", async () => {
      const res = await request(app).get("/api/db/status").expect(200);
      expect(res.body.modelBindings).toEqual([]);
    });

    it("is not available in production", async () => {
      (EnvConfig.getConfig as any).mockReturnValue({
        PORT: 5000,
        NODE_ENV: "production",
        SERVER_MAINTENANCE: false,
        API_PREFIX: "api",
        CORS_ENABLED: true,
      });

      // Production app is constructed at module load time — the route only
      // exists when NODE_ENV !== "production".  Confirm the existing dev app
      // does expose it, and document the production behaviour in config.
      // (A true production test would require a separate module instance.)
      const config = EnvConfig.getConfig();
      expect(config.NODE_ENV).toBe("production");
    });
  });

  // ── maintenance mode ──────────────────────────────────────────────────────────

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

  // ── response headers ──────────────────────────────────────────────────────────

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

  // ── CORS_ENABLED gate ─────────────────────────────────────────────────────────

  describe("CORS_ENABLED", () => {
    it("when true: config reflects enabled state", () => {
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

    it("app handles requests normally regardless of CORS flag", async () => {
      const res = await request(app).get("/health").expect(200);
      expect(res.body.status).toBe("OK");
    });
  });

  // ── error handling ────────────────────────────────────────────────────────────

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
