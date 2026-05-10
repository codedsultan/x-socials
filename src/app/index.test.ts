import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import request from "supertest";
import ExpressApp from "./index";
import EnvConfig from "../config/env";

// Mock the entire Logger module
vi.mock("../logger", () => ({
    default: {
        getInstance: vi.fn(() => ({
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        })),
        _init: vi.fn(),
    }
}));

// Mock EnvConfig with proper spyable methods
vi.mock("../config/env", () => ({
    default: {
        getConfig: vi.fn(() => ({
            PORT: 5000,
            NODE_ENV: "development",
            SERVER_MAINTENANCE: false,
        })),
        isProduction: vi.fn(() => false),
        isDevelopment: vi.fn(() => true),
        isStaging: vi.fn(() => false),
        isTest: vi.fn(() => false),
        isServerMaintenance: vi.fn(() => false),
        getApiUrl: vi.fn(() => "http://localhost:5000"),
        init: vi.fn(),
    }
}));

// Mock Monitoring
vi.mock("../monitoring/monitoring", () => ({
    default: {
        getInstance: vi.fn(() => ({
            middleware: vi.fn(() => (_req: any, _res: any, next: any) => next()),
            recordError: vi.fn(),
            incrementExternalApiCall: vi.fn(),
            recordUserSignup: vi.fn(),
            recordDatabaseQuery: vi.fn(),
        })),
    }
}));

describe("ExpressApp", () => {
    let app: any;

    beforeAll(() => {
        app = ExpressApp.getApp();
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset maintenance mode to false before each test
        (EnvConfig.isServerMaintenance as any).mockReturnValue(false);
    });

    describe("GET /health", () => {
        it("should return status OK", async () => {
            const response = await request(app)
                .get("/health")
                .expect(200);

            expect(response.body.status).toBe("OK");
            expect(response.body).toHaveProperty("timestamp");
            expect(response.body).toHaveProperty("environment");
            expect(response.body).toHaveProperty("version");
            expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
        });

        it("should return correct environment info", async () => {
            const response = await request(app)
                .get("/health")
                .expect(200);

            expect(response.body.environment).toBe("development");
            expect(response.body.maintenance).toBe(false);
        });
    });

    describe("GET /ready", () => {
        it("should return ready status", async () => {
            const response = await request(app)
                .get("/ready")
                .expect(200);

            expect(response.body.status).toBe("ready");
        });
    });

    describe("GET /live", () => {
        it("should return alive status", async () => {
            const response = await request(app)
                .get("/live")
                .expect(200);

            expect(response.body.status).toBe("alive");
        });
    });

    describe("GET /", () => {
        it("should return welcome message", async () => {
            const response = await request(app)
                .get("/")
                .expect(200);

            expect(response.body.message).toContain("Social Media API");
            expect(response.body.version).toBe("1.0.0");
            expect(response.body).toHaveProperty("timestamp");
            expect(response.body).toHaveProperty("environment");
        });

        it("should include monitoring info in response", async () => {
            const response = await request(app)
                .get("/")
                .expect(200);

            expect(response.body.monitoring).toBeDefined();
            expect(response.body.monitoring.metrics).toContain("/metrics");
        });

        it("should have correct content type", async () => {
            const response = await request(app)
                .get("/")
                .expect(200);

            expect(response.headers["content-type"]).toContain("application/json");
        });
    });

    describe("GET /api/environment", () => {
        it("should return environment configuration", async () => {
            const response = await request(app)
                .get("/api/environment")
                .expect(200);

            expect(response.body.environment).toBeDefined();
            expect(response.body.maintenance).toBeDefined();
            expect(response.body.apiUrl).toBeDefined();
            expect(response.body.timestamp).toBeDefined();
        });
    });

    describe("GET /api/users", () => {
        it("should return users list", async () => {
            const response = await request(app)
                .get("/api/users")
                .expect(200);

            expect(response.body.users).toBeInstanceOf(Array);
            expect(response.body.users.length).toBe(2);
            expect(response.body.users[0]).toHaveProperty("id");
            expect(response.body.users[0]).toHaveProperty("name");
        });

        it("should return users with correct structure", async () => {
            const response = await request(app)
                .get("/api/users")
                .expect(200);

            const firstUser = response.body.users[0];
            expect(typeof firstUser.id).toBe("number");
            expect(typeof firstUser.name).toBe("string");
        });
    });

    describe("Maintenance mode", () => {
        it("should return 503 when maintenance mode is enabled", async () => {
            // Mock maintenance mode to return true
            (EnvConfig.isServerMaintenance as any).mockReturnValue(true);

            const response = await request(app)
                .get("/")
                .expect(503);

            expect(response.body.error).toContain("maintenance");
        });

        it("should skip maintenance check for health endpoint", async () => {
            (EnvConfig.isServerMaintenance as any).mockReturnValue(true);

            const response = await request(app)
                .get("/health")
                .expect(200);

            expect(response.body.status).toBe("OK");
        });
    });

    describe("Error handling", () => {
        it("should return error object without stack trace in production", async () => {
            // Save original NODE_ENV
            const originalEnv = process.env.NODE_ENV;

            // Mock production environment
            process.env.NODE_ENV = "production";
            (EnvConfig.getConfig as any).mockReturnValue({
                PORT: 5000,
                NODE_ENV: "production",
                SERVER_MAINTENANCE: false,
            });

            // Need to re-initialize app to apply new config? 
            // Instead, test the error handling logic directly
            const response = await request(app)
                .get("/api/error")
                .expect(500);

            expect(response.body.error).toBe("Internal server error");
            // In production, should NOT include message
            expect(response.body.message).toBeUndefined();

            // Restore
            process.env.NODE_ENV = originalEnv;
            (EnvConfig.getConfig as any).mockReturnValue({
                PORT: 5000,
                NODE_ENV: "development",
                SERVER_MAINTENANCE: false,
            });
        });
    });

    describe("CORS and headers", () => {
        it("should set environment headers", async () => {
            const response = await request(app)
                .get("/")
                .expect(200);

            expect(response.headers["x-environment"]).toBeDefined();
            expect(response.headers["x-api-version"]).toBe("1.0.0");
        });
    });
});