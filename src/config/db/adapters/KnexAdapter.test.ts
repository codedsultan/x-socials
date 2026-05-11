import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { IDbConnectionConfig } from "../../../interfaces/core/database";

// vi.mock is hoisted above imports — use vi.hoisted() so the shared mock
// objects exist before the factory runs.
const { mockRaw, mockDestroy, mockKnexInstance, mockKnexFactory } = vi.hoisted(() => {
  const mockRaw = vi.fn();
  const mockDestroy = vi.fn();
  const mockKnexInstance = {
    raw: mockRaw,
    destroy: mockDestroy,
    // Add the client property that KnexUtils needs
    client: {
      driverName: "pg", // Default to pg for the mock
    },
  };
  const mockKnexFactory = vi.fn(() => mockKnexInstance);
  return { mockRaw, mockDestroy, mockKnexInstance, mockKnexFactory };
});

vi.mock("knex", () => ({ default: mockKnexFactory }));

vi.mock("../../logger", () => ({
  default: {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

import { KnexAdapter } from "./KnexAdapter";

const pgConfig = (overrides: Partial<IDbConnectionConfig> = {}): IDbConnectionConfig => ({
  name: "test-pg",
  driver: "pg",
  host: "localhost",
  port: 5432,
  database: "test_db",
  user: "admin",
  password: "secret",
  pool: { min: 2, max: 10 },
  ...overrides,
});

const sqliteConfig = (overrides: Partial<IDbConnectionConfig> = {}): IDbConnectionConfig => ({
  name: "test-sqlite",
  driver: "sqlite3",
  filename: ":memory:",
  ...overrides,
});

describe("KnexAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRaw.mockResolvedValue([]);
    mockDestroy.mockResolvedValue(undefined);
    // Reset the driverName to default for each test
    mockKnexInstance.client.driverName = "pg";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });


  describe("identity", () => {
    it("exposes name from config", () => {
      const adapter = new KnexAdapter(pgConfig());
      expect(adapter.name).toBe("test-pg");
    });

    it("exposes driver from config", () => {
      const adapter = new KnexAdapter(pgConfig({ driver: "mysql2", name: "my" }));
      expect(adapter.driver).toBe("mysql2");
    });
  });

  describe("connect()", () => {
    it("returns true and calls knex factory on success", async () => {
      const adapter = new KnexAdapter(pgConfig());
      const result = await adapter.connect();

      expect(result).toBe(true);
      expect(mockKnexFactory).toHaveBeenCalledOnce();
      expect(mockRaw).toHaveBeenCalledWith("SELECT 1");
    });

    it("passes pool config to knex", async () => {
      const adapter = new KnexAdapter(pgConfig({ pool: { min: 3, max: 15 } }));
      await adapter.connect();

      expect(mockKnexFactory).toHaveBeenCalledWith(
        expect.objectContaining({ pool: { min: 3, max: 15 } })
      );
    });

    it("uses default pool values when not supplied", async () => {
      const adapter = new KnexAdapter(pgConfig({ pool: undefined }));
      await adapter.connect();

      expect(mockKnexFactory).toHaveBeenCalledWith(
        expect.objectContaining({ pool: { min: 2, max: 10 } })
      );
    });

    it("uses filename and useNullAsDefault for SQLite", async () => {
      const adapter = new KnexAdapter(sqliteConfig());
      await adapter.connect();

      expect(mockKnexFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          useNullAsDefault: true,
          connection: expect.objectContaining({ filename: ":memory:" }),
        })
      );
    });

    it("returns false when raw SELECT 1 throws an Error", async () => {
      mockRaw.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const adapter = new KnexAdapter(pgConfig());

      expect(await adapter.connect()).toBe(false);
    });

    it("handles non-Error rejection objects gracefully", async () => {
      mockRaw.mockRejectedValueOnce("plain string error");
      const adapter = new KnexAdapter(pgConfig());

      expect(await adapter.connect()).toBe(false);
    });

    it("does not create a second knex instance when already connected", async () => {
      const adapter = new KnexAdapter(pgConfig());
      await adapter.connect();
      await adapter.connect();

      expect(mockKnexFactory).toHaveBeenCalledTimes(1);
    });

    it("marks adapter as connected after success", async () => {
      const adapter = new KnexAdapter(pgConfig());
      expect(adapter.isConnected()).toBe(false);

      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);
    });
  });

  describe("disconnect()", () => {
    it("calls knex.destroy and marks as disconnected", async () => {
      const adapter = new KnexAdapter(pgConfig());
      await adapter.connect();
      await adapter.disconnect();

      expect(mockDestroy).toHaveBeenCalledTimes(1);
      expect(adapter.isConnected()).toBe(false);
    });

    it("is a no-op when not connected", async () => {
      const adapter = new KnexAdapter(pgConfig());
      await adapter.disconnect();

      expect(mockDestroy).not.toHaveBeenCalled();
    });
  });

  describe("ping()", () => {
    it("returns true when SELECT 1 succeeds", async () => {
      const adapter = new KnexAdapter(pgConfig());
      await adapter.connect();

      expect(await adapter.ping()).toBe(true);
    });

    it("returns false when not connected", async () => {
      const adapter = new KnexAdapter(pgConfig());
      expect(await adapter.ping()).toBe(false);
    });

    it("returns false when SELECT 1 throws", async () => {
      const adapter = new KnexAdapter(pgConfig());
      await adapter.connect();
      mockRaw.mockRejectedValueOnce(new Error("lost connection"));

      expect(await adapter.ping()).toBe(false);
    });
  });

  describe("getClient()", () => {
    it("returns null before connecting", () => {
      const adapter = new KnexAdapter(pgConfig());
      expect(adapter.getClient()).toBeNull();
    });

    it("returns the knex instance after connecting", async () => {
      const adapter = new KnexAdapter(pgConfig());
      await adapter.connect();

      expect(adapter.getClient()).toBe(mockKnexInstance);
    });

    it("returns null after disconnect", async () => {
      const adapter = new KnexAdapter(pgConfig());
      await adapter.connect();
      await adapter.disconnect();

      expect(adapter.getClient()).toBeNull();
    });
  });

  describe("dialect helpers", () => {
    it("isPostgres is true for pg driver", () => {
      expect(new KnexAdapter(pgConfig({ driver: "pg" })).isPostgres).toBe(true);
    });

    it("isPostgres is true for pg-native driver", () => {
      expect(new KnexAdapter(pgConfig({ driver: "pg-native" })).isPostgres).toBe(true);
    });

    it("isPostgres is false for mysql2", () => {
      expect(new KnexAdapter(pgConfig({ driver: "mysql2" })).isPostgres).toBe(false);
    });

    it("isMySQL is true for mysql driver", () => {
      expect(new KnexAdapter(pgConfig({ driver: "mysql", name: "m" })).isMySQL).toBe(true);
    });

    it("isMySQL is true for mysql2 driver", () => {
      expect(new KnexAdapter(pgConfig({ driver: "mysql2", name: "m" })).isMySQL).toBe(true);
    });

    it("isSQLite is true for sqlite3", () => {
      expect(new KnexAdapter(sqliteConfig({ driver: "sqlite3" })).isSQLite).toBe(true);
    });

    it("isSQLite is true for better-sqlite3", () => {
      expect(new KnexAdapter(sqliteConfig({ driver: "better-sqlite3" })).isSQLite).toBe(true);
    });

    it("compatibleILIKE returns andWhereILike for postgres", () => {
      expect(new KnexAdapter(pgConfig({ driver: "pg" })).compatibleILIKE).toBe("andWhereILike");
    });

    it("compatibleILIKE returns andWhereLike for non-postgres", () => {
      expect(new KnexAdapter(pgConfig({ driver: "mysql2", name: "m" })).compatibleILIKE).toBe("andWhereLike");
    });
  });

  describe("utils getter", () => {
    it("throws when accessed before connect()", () => {
      const adapter = new KnexAdapter(pgConfig());
      expect(() => adapter.utils).toThrow(/accessed before connect/i);
    });

    it("returns a KnexUtils instance after connect()", async () => {
      const adapter = new KnexAdapter(pgConfig());
      await adapter.connect();
      expect(adapter.utils).toBeDefined();
    });
  });

  // describe("truncatedTimestamp()", () => {
  //   it("delegates to KnexUtils and returns a raw SQL fragment", async () => {
  //     const adapter = new KnexAdapter(pgConfig());
  //     await adapter.connect();

  //     // mockRaw is already set up to return [] — calling it should not throw
  //     expect(() => adapter.truncatedTimestamp("created_at", "hour")).not.toThrow();
  //   });

  //   it("defaults to hour precision when no argument is given", async () => {
  //     const adapter = new KnexAdapter(pgConfig());
  //     await adapter.connect();

  //     adapter.truncatedTimestamp("created_at");

  //     // mockRaw should have been called (by KnexUtils internally)
  //     expect(mockRaw).toHaveBeenCalled();
  //   });

  //   it("throws before connect() because utils getter throws", () => {
  //     const adapter = new KnexAdapter(pgConfig());
  //     expect(() => adapter.truncatedTimestamp("ts", "day")).toThrow(
  //       /accessed before connect/i
  //     );
  //   });
  // });

  describe("truncatedTimestamp()", () => {
    it("delegates to KnexUtils and returns a raw SQL fragment", async () => {
      const adapter = new KnexAdapter(pgConfig());
      await adapter.connect();

      // Now the mock has client.driverName = "pg", so KnexUtils won't throw
      // const result = 
      adapter.truncatedTimestamp("created_at", "hour");

      // Verify it called knex.raw with the correct PostgreSQL syntax
      expect(mockRaw).toHaveBeenCalledWith(
        expect.stringContaining("date_trunc"),
        expect.any(Array)
      );
    });

    it("works with different driver names", async () => {
      const adapter = new KnexAdapter(pgConfig());
      await adapter.connect();

      // Change the mock driver to test SQLite path
      mockKnexInstance.client.driverName = "sqlite3";

      // const result = 
      adapter.truncatedTimestamp("created_at", "hour");

      // Should use strftime for SQLite
      expect(mockRaw).toHaveBeenCalledWith(
        expect.stringContaining("strftime"),
        expect.any(Array)
      );
    });

    it("defaults to hour precision when no argument is given", async () => {
      const adapter = new KnexAdapter(pgConfig());
      await adapter.connect();

      adapter.truncatedTimestamp("created_at");

      // Verify it was called with the default "hour" precision
      expect(mockRaw).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["hour", "created_at"])
      );
    });

    it("throws before connect() because utils getter throws", () => {
      const adapter = new KnexAdapter(pgConfig());
      expect(() => adapter.truncatedTimestamp("ts", "day")).toThrow(
        /accessed before connect/i
      );
    });
  });
});
