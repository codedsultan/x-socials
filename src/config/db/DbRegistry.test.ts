import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IDbAdapter } from "../../interfaces/core/database";
import { DbRegistry } from "./DbRegistry";

vi.mock("../logger", () => ({
  default: {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));



const makeAdapter = (name: string, pingResult = true): IDbAdapter => ({
  name,
  driver: "mongoose",
  connect: vi.fn().mockResolvedValue(true),
  disconnect: vi.fn().mockResolvedValue(undefined),
  ping: vi.fn().mockResolvedValue(pingResult),
  isConnected: vi.fn().mockReturnValue(true),
  getClient: vi.fn().mockReturnValue({}),
});

describe("DbRegistry", () => {
  let registry: DbRegistry;

  beforeEach(() => {
    registry = new DbRegistry();
  });

  describe("register()", () => {
    it("registers an adapter without throwing", () => {
      expect(() => registry.register(makeAdapter("mongo"))).not.toThrow();
    });

    it("throws when registering a duplicate name", () => {
      registry.register(makeAdapter("mongo"));
      expect(() => registry.register(makeAdapter("mongo"))).toThrow(/already registered/i);
    });

    it("allows multiple adapters with different names", () => {
      registry.register(makeAdapter("mongo"));
      registry.register(makeAdapter("postgres"));
      expect(registry.list()).toHaveLength(2);
    });
  });

  describe("get()", () => {
    it("returns a registered adapter by name", () => {
      const adapter = makeAdapter("mongo");
      registry.register(adapter);
      expect(registry.get("mongo")).toBe(adapter);
    });

    it("throws for an unknown connection name", () => {
      expect(() => registry.get("unknown")).toThrow(/No adapter found/i);
    });

    it("error message lists available adapters", () => {
      registry.register(makeAdapter("mongo"));
      expect(() => registry.get("missing")).toThrow(/mongo/);
    });
  });

  describe("getDefault()", () => {
    it("throws when no default has been set", () => {
      registry.register(makeAdapter("mongo"));
      expect(() => registry.getDefault()).toThrow(/No default/i);
    });

    it("returns the adapter set as default", () => {
      const adapter = makeAdapter("mongo");
      registry.register(adapter);
      registry.setDefault("mongo");
      expect(registry.getDefault()).toBe(adapter);
    });
  });

  describe("setDefault()", () => {
    it("throws when setting default for an unregistered name", () => {
      expect(() => registry.setDefault("ghost")).toThrow(/not registered/i);
    });

    it("allows changing the default from one adapter to another", () => {
      const a = makeAdapter("a");
      const b = makeAdapter("b");
      registry.register(a);
      registry.register(b);

      registry.setDefault("a");
      expect(registry.getDefault()).toBe(a);

      registry.setDefault("b");
      expect(registry.getDefault()).toBe(b);
    });

    it("does not throw when overwriting default with a different adapter", () => {
      const a = makeAdapter("a");
      const b = makeAdapter("b");
      registry.register(a);
      registry.register(b);
      registry.setDefault("a");

      expect(() => registry.setDefault("b")).not.toThrow();
      expect(registry.getDefault()).toBe(b);
    });
  });

  describe("list()", () => {
    it("returns empty array when no adapters registered", () => {
      expect(registry.list()).toEqual([]);
    });

    it("returns all registered adapter names", () => {
      registry.register(makeAdapter("mongo"));
      registry.register(makeAdapter("pg"));
      expect(registry.list()).toEqual(expect.arrayContaining(["mongo", "pg"]));
    });
  });

  describe("connectAll()", () => {
    it("calls connect() on every registered adapter", async () => {
      const a = makeAdapter("a");
      const b = makeAdapter("b");
      registry.register(a);
      registry.register(b);

      await registry.connectAll();

      expect(a.connect).toHaveBeenCalledTimes(1);
      expect(b.connect).toHaveBeenCalledTimes(1);
    });

    it("resolves without throwing when one adapter fails", async () => {
      const good = makeAdapter("good");
      const bad = makeAdapter("bad");
      (bad.connect as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("refused"));

      registry.register(good);
      registry.register(bad);

      await expect(registry.connectAll()).resolves.toBeUndefined();
    });

    it("continues connecting remaining adapters when one rejects", async () => {
      const bad = makeAdapter("bad");
      const good = makeAdapter("good");
      (bad.connect as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("refused"));

      registry.register(bad);
      registry.register(good);

      await registry.connectAll();

      expect(good.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe("disconnectAll()", () => {
    it("calls disconnect() on every registered adapter", async () => {
      const a = makeAdapter("a");
      const b = makeAdapter("b");
      registry.register(a);
      registry.register(b);

      await registry.disconnectAll();

      expect(a.disconnect).toHaveBeenCalledTimes(1);
      expect(b.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("healthCheck()", () => {
    it("returns a map of name to ping result", async () => {
      registry.register(makeAdapter("mongo", true));
      registry.register(makeAdapter("pg", false));

      const result = await registry.healthCheck();

      expect(result).toEqual({ mongo: true, pg: false });
    });

    it("returns empty object when no adapters registered", async () => {
      expect(await registry.healthCheck()).toEqual({});
    });

    it("propagates a ping rejection rather than swallowing it", async () => {
      const throwing = makeAdapter("bad");
      (throwing.ping as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("timeout")
      );
      registry.register(throwing);

      await expect(registry.healthCheck()).rejects.toThrow("timeout");
    });
  });
});
