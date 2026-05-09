import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import ExpressApp from "../../app/index";
import Logger from "../../logger/index";

describe("API Integration Tests", () => {
    let app: any;

    beforeAll(() => {
        app = ExpressApp.getApp();
    });

    describe("Full request/response cycle", () => {
        it("should handle multiple sequential requests", async () => {
            // First request
            const response1 = await request(app).get("/");
            expect(response1.status).toBe(200);

            // Second request
            const response2 = await request(app).get("/health");
            expect(response2.status).toBe(200);

            // Third request
            const response3 = await request(app).get("/api/users");
            expect(response3.status).toBe(200);
        });

        it("should maintain proper content types", async () => {
            const response = await request(app).get("/");
            expect(response.headers["content-type"]).toContain("application/json");
        });

        it("should log requests (verify logger was called)", async () => {
            const loggerSpy = vi.spyOn(Logger.getInstance(), "info");

            await request(app).get("/health");

            expect(loggerSpy).toHaveBeenCalledWith(
                expect.stringMatching(/GET \/health/)
            );
        });
    });
});