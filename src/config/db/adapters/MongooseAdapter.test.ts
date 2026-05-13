import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { IDbConnectionConfig } from "../../../interfaces/core/database";

// vi.mock is hoisted above all imports by Vitest, so any variables it references
// must also be hoisted with vi.hoisted() — otherwise they are TDZ at hoist time.
const { mockConnection } = vi.hoisted(() => {
  const mockConnection = { readyState: 1 };
  return { mockConnection };
});

vi.mock("mongoose", () => ({
  default: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    connection: mockConnection,
  },
}));

vi.mock("../../logger", () => ({
  default: {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

import mongoose from "mongoose";
import { MongooseAdapter } from "./MongooseAdapter";

const makeConfig = (overrides: Partial<IDbConnectionConfig> = {}): IDbConnectionConfig => ({
  name: "test-mongo",
  driver: "mongoose",
  uri: "mongodb://localhost:27017",
  dbName: "test_db",
  ...overrides,
});

describe("MongooseAdapter", () => {
  let adapter: MongooseAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnection.readyState = 1;
    adapter = new MongooseAdapter(makeConfig());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("identity", () => {
    it("exposes the name from config", () => {
      expect(adapter.name).toBe("test-mongo");
    });

    it("exposes driver as 'mongoose'", () => {
      expect(adapter.driver).toBe("mongoose");
    });
  });

  describe("connect()", () => {
    it("returns true and calls mongoose.connect on success", async () => {
      vi.mocked(mongoose.connect).mockResolvedValueOnce(undefined as any);

      const result = await adapter.connect();

      expect(result).toBe(true);
      expect(mongoose.connect).toHaveBeenCalledWith(
        "mongodb://localhost:27017",
        expect.objectContaining({ dbName: "test_db" })
      );
    });

    it("passes socketTimeoutMS and serverSelectionTimeoutMS to mongoose", async () => {
      vi.mocked(mongoose.connect).mockResolvedValueOnce(undefined as any);

      const customAdapter = new MongooseAdapter(
        makeConfig({ socketTimeoutMS: 10_000, serverSelectionTimeoutMS: 2_000 })
      );
      await customAdapter.connect();

      expect(mongoose.connect).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ socketTimeoutMS: 10_000, serverSelectionTimeoutMS: 2_000 })
      );
    });

    it("uses default timeouts when not supplied", async () => {
      vi.mocked(mongoose.connect).mockResolvedValueOnce(undefined as any);

      await adapter.connect();

      expect(mongoose.connect).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ socketTimeoutMS: 30_000, serverSelectionTimeoutMS: 5_000 })
      );
    });

    it("returns false when mongoose.connect rejects with an Error", async () => {
      vi.mocked(mongoose.connect).mockRejectedValueOnce(new Error("Connection refused"));

      const result = await adapter.connect();

      expect(result).toBe(false);
    });

    it("returns false and handles non-Error rejection objects", async () => {
      vi.mocked(mongoose.connect).mockRejectedValueOnce("string error");

      const result = await adapter.connect();

      expect(result).toBe(false);
    });

    it("throws when uri is missing from config", async () => {
      const noUri = new MongooseAdapter(makeConfig({ uri: undefined }));

      await expect(noUri.connect()).rejects.toThrow("Missing URI");
    });

    it("does not call mongoose.connect a second time when already connected", async () => {
      vi.mocked(mongoose.connect).mockResolvedValue(undefined as any);

      await adapter.connect();
      await adapter.connect();

      expect(mongoose.connect).toHaveBeenCalledTimes(1);
    });

    it("marks adapter as connected after success", async () => {
      vi.mocked(mongoose.connect).mockResolvedValueOnce(undefined as any);

      expect(adapter.isConnected()).toBe(false);
      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);
    });
  });

  describe("disconnect()", () => {
    it("calls mongoose.disconnect when connected", async () => {
      vi.mocked(mongoose.connect).mockResolvedValueOnce(undefined as any);
      vi.mocked(mongoose.disconnect).mockResolvedValueOnce(undefined);

      await adapter.connect();
      await adapter.disconnect();

      expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
      expect(adapter.isConnected()).toBe(false);
    });

    it("is a no-op when not connected", async () => {
      await adapter.disconnect();

      expect(mongoose.disconnect).not.toHaveBeenCalled();
    });
  });

  describe("ping()", () => {
    it("returns true when readyState is 1 and connected", async () => {
      vi.mocked(mongoose.connect).mockResolvedValueOnce(undefined as any);
      await adapter.connect();
      mockConnection.readyState = 1;

      expect(await adapter.ping()).toBe(true);
    });

    it("returns false when not connected (no client set)", async () => {
      expect(await adapter.ping()).toBe(false);
    });

    it("returns false when readyState is not 1", async () => {
      vi.mocked(mongoose.connect).mockResolvedValueOnce(undefined as any);
      await adapter.connect();
      mockConnection.readyState = 0;

      expect(await adapter.ping()).toBe(false);
    });
  });

  describe("isConnected()", () => {
    it("returns false initially", () => {
      expect(adapter.isConnected()).toBe(false);
    });

    it("returns true after a successful connect", async () => {
      vi.mocked(mongoose.connect).mockResolvedValueOnce(undefined as any);
      await adapter.connect();

      expect(adapter.isConnected()).toBe(true);
    });

    it("returns false after disconnect", async () => {
      vi.mocked(mongoose.connect).mockResolvedValueOnce(undefined as any);
      vi.mocked(mongoose.disconnect).mockResolvedValueOnce(undefined);

      await adapter.connect();
      await adapter.disconnect();

      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe("getClient()", () => {
    it("returns null before connecting", () => {
      expect(adapter.getClient()).toBeNull();
    });

    it("returns the mongoose connection after connecting", async () => {
      vi.mocked(mongoose.connect).mockResolvedValueOnce(undefined as any);
      await adapter.connect();

      expect(adapter.getClient()).toBe(mockConnection);
    });
  });
});
