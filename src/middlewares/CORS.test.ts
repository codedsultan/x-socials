import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import CORS from "./CORS";

vi.mock("../logger", () => ({
  default: {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

describe("CORS middleware", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    CORS.mount(app);
    app.get("/test", (_req, res) => res.json({ ok: true }));
  });

  it("should mount and return the application", () => {
    const freshApp = express();
    const result = CORS.mount(freshApp);
    expect(result).toBe(freshApp);
  });

  it("should set Access-Control-Allow-Origin header", async () => {
    const response = await request(app)
      .get("/test")
      .set("Origin", "http://example.com")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBeDefined();
  });

  it("should respond with 200 to OPTIONS preflight requests", async () => {
    await request(app)
      .options("/test")
      .set("Origin", "http://example.com")
      .set("Access-Control-Request-Method", "GET")
      .expect(200);
  });

  it("should expose x-auth-token header", async () => {
    const response = await request(app)
      .get("/test")
      .set("Origin", "http://example.com");

    expect(
      response.headers["access-control-expose-headers"]
    ).toContain("x-auth-token");
  });

  it("should allow credentials", async () => {
    const response = await request(app)
      .get("/test")
      .set("Origin", "http://example.com");

    expect(
      response.headers["access-control-allow-credentials"]
    ).toBe("true");
  });

  it("should allow standard HTTP methods", async () => {
    const response = await request(app)
      .options("/test")
      .set("Origin", "http://example.com")
      .set("Access-Control-Request-Method", "POST");

    // Methods header is set on preflight
    const allowMethods =
      response.headers["access-control-allow-methods"] ?? "";
    expect(allowMethods).toMatch(/GET|POST|DELETE|PUT|PATCH/i);
  });

  it("is a singleton — mount always uses the same instance options", () => {
    const freshApp1 = express();
    const freshApp2 = express();
    // Both calls use the same CORS instance, so no error
    expect(() => {
      CORS.mount(freshApp1);
      CORS.mount(freshApp2);
    }).not.toThrow();
  });
});
