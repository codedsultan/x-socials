import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import ExpressApp from "./index";

// Mock the entire Logger module
vi.mock("../logger", () => ({
    default: {
        getInstance: vi.fn(() => ({
            info: vi.fn().mockReturnThis(),  // Returns the logger instance for chaining
            error: vi.fn().mockReturnThis(), // Returns the logger instance for chaining
            warn: vi.fn().mockReturnThis(),  // Returns the logger instance for chaining
            debug: vi.fn().mockReturnThis(), // Returns the logger instance for chaining
        })),
        _init: vi.fn().mockReturnValue({
            info: vi.fn().mockReturnThis(),
            error: vi.fn().mockReturnThis(),
            warn: vi.fn().mockReturnThis(),
            debug: vi.fn().mockReturnThis(),
        }),
        _reset: vi.fn(), // Add this if you use it in tests
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

    // Your test cases remain the same...
    describe("GET /health", () => {
        it("should return status OK", async () => {
            const response = await request(app)
                .get("/health")
                .expect(200);

            expect(response.body.status).toBe("OK");
            expect(response.body).toHaveProperty("timestamp");
            expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
        });
    });

    describe("GET /", () => {
        it("should return welcome message", async () => {
            const response = await request(app)
                .get("/")
                .expect(200);

            expect(response.body.message).toContain("Test Server - Social Media API");
            expect(response.body.version).toBe("1.0.0");
            expect(response.body).toHaveProperty("timestamp");
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
    });

    describe("404 handler", () => {
        it("should return 404 for unknown routes", async () => {
            const response = await request(app)
                .get("/unknown-route-12345")
                .expect(404);

            expect(response.body.error).toBe("Route not found");
            expect(response.body).toHaveProperty("path");
        });
    });
});