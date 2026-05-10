import { describe, it, expect } from "vitest";
import ApiError from "./ApiError";

describe("ApiError", () => {
  it("should create an instance with message and statusCode", () => {
    const error = new ApiError("Not found", 404);
    expect(error.message).toBe("Not found");
    expect(error.statusCode).toBe(404);
  });

  it("should be an instance of Error", () => {
    const error = new ApiError("Unauthorized", 401);
    expect(error).toBeInstanceOf(Error);
  });

  it("should be an instance of ApiError", () => {
    const error = new ApiError("Bad request", 400);
    expect(error).toBeInstanceOf(ApiError);
  });

  it("should capture the stack trace", () => {
    const error = new ApiError("Server error", 500);
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("ApiError");
  });

  it("should have the correct name from Error prototype", () => {
    const error = new ApiError("Conflict", 409);
    // Error.captureStackTrace sets the constructor name in the stack
    expect(error.stack).toContain("ApiError");
  });

  it("should store different status codes correctly", () => {
    const codes = [200, 201, 400, 401, 403, 404, 409, 422, 500, 503];
    codes.forEach((code) => {
      const err = new ApiError("msg", code);
      expect(err.statusCode).toBe(code);
    });
  });

  it("should allow message mutation (Handler pattern)", () => {
    const error = new ApiError("Original", 400);
    error.message = "Updated message";
    expect(error.message).toBe("Updated message");
  });

  it("should allow statusCode mutation (Handler pattern)", () => {
    const error = new ApiError("msg", 400);
    error.statusCode = 401;
    expect(error.statusCode).toBe(401);
  });

  it("should handle empty string message", () => {
    const error = new ApiError("", 400);
    expect(error.message).toBe("");
    expect(error.statusCode).toBe(400);
  });
});
