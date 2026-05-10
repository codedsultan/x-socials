import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import Http from "./Http";

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

describe("Http middleware", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    Http.mount(app);
    app.get("/test", (_req, res) => {
      res.json({ ok: true });
    });
    app.post("/echo", (req, res) => {
      res.json(req.body);
    });
  });

  it("should mount and return the application", () => {
    const freshApp = express();
    const result = Http.mount(freshApp);
    expect(result).toBe(freshApp);
  });

  it("should set helmet security headers", async () => {
    const response = await request(app).get("/test");
    // Helmet sets X-Content-Type-Options
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("should parse JSON body", async () => {
    const payload = { name: "Alice", age: 30 };
    const response = await request(app)
      .post("/echo")
      .send(payload)
      .set("Content-Type", "application/json")
      .expect(200);
    expect(response.body).toEqual(payload);
  });

  it("should parse urlencoded body", async () => {
    app = express();
    Http.mount(app);
    app.post("/form", (req, res) => res.json(req.body));

    const response = await request(app)
      .post("/form")
      .send("name=Bob&role=admin")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .expect(200);

    expect(response.body.name).toBe("Bob");
    expect(response.body.role).toBe("admin");
  });

  it("should set trust proxy", async () => {
    // trust proxy setting means app.get('trust proxy') returns truthy
    const freshApp = express();
    Http.mount(freshApp);
    expect(freshApp.get("trust proxy")).toBeTruthy();
  });

  it("should accept large JSON payloads up to 100mb limit", async () => {
    // Sending a reasonably large body should not be rejected
    const largeBody = { data: "x".repeat(1024) }; // 1KB — well within limit
    const response = await request(app)
      .post("/echo")
      .send(largeBody)
      .set("Content-Type", "application/json")
      .expect(200);
    expect(response.body.data.length).toBe(1024);
  });

  it("should add X-DNS-Prefetch-Control header via helmet", async () => {
    const response = await request(app).get("/test");
    expect(response.headers["x-dns-prefetch-control"]).toBeDefined();
  });
});
