import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import Morgan from "./Morgan";

const mockHttp = vi.fn();
const mockInfo = vi.fn();

vi.mock("../logger", () => ({
  default: {
    getInstance: vi.fn(() => ({
      info: mockInfo,
      http: mockHttp,
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

describe("Morgan middleware", () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    Morgan.mount(app);
    app.get("/test", (_req, res) => res.json({ ok: true }));
  });

  it("should mount and return the application", () => {
    const freshApp = express();
    const result = Morgan.mount(freshApp);
    expect(result).toBe(freshApp);
  });

  it("should log a message via the Logger http level on request", async () => {
    await request(app).get("/test").expect(200);
    expect(mockHttp).toHaveBeenCalledTimes(1);
  });

  it("should include method and path in the log message", async () => {
    await request(app).get("/test");
    const loggedMessage: string = mockHttp.mock.calls[0][0];
    expect(loggedMessage).toContain("GET");
    expect(loggedMessage).toContain("/test");
  });

  it("should include HTTP status code in the log message", async () => {
    await request(app).get("/test");
    const loggedMessage: string = mockHttp.mock.calls[0][0];
    expect(loggedMessage).toContain("200");
  });

  it("should include response time in the log message", async () => {
    await request(app).get("/test");
    const loggedMessage: string = mockHttp.mock.calls[0][0];
    expect(loggedMessage).toMatch(/\d+(\.\d+)? ms/);
  });

  it("should log the registration info message on mount", () => {
    const freshApp = express();
    Morgan.mount(freshApp);
    expect(mockInfo).toHaveBeenCalledWith(
      "App :: Registering Morgan middleware..."
    );
  });

  it("should log each request independently", async () => {
    await request(app).get("/test");
    await request(app).get("/test");
    expect(mockHttp).toHaveBeenCalledTimes(2);
  });
});
