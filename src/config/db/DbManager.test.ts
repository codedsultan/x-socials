import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { IDbConnectionConfig, IDbAdapter } from "../../interfaces/core/database";
import DbManager from "./DbManager";
import { AdapterFactory } from "./AdapterFactory";

vi.mock("../logger", () => ({
  default: {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

const mockConnect = vi.fn().mockResolvedValue(true);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const mockPing = vi.fn().mockResolvedValue(true);

const mockAdapterInstance = (name: string): IDbAdapter => ({
  name,
  driver: "mongoose",
  connect: mockConnect,
  disconnect: mockDisconnect,
  ping: mockPing,
  isConnected: vi.fn().mockReturnValue(true),
  getClient: vi.fn().mockReturnValue({}),
});

vi.mock("./AdapterFactory", () => ({
  AdapterFactory: {
    create: vi.fn((config: IDbConnectionConfig) => mockAdapterInstance(config.name)),
  },
}));


const mongoConfig = (overrides: Partial<IDbConnectionConfig> = {}): IDbConnectionConfig => ({
  name: "mongodb",
  driver: "mongoose",
  uri: "mongodb://localhost:27017",
  isDefault: true,
  ...overrides,
});

const pgConfig = (overrides: Partial<IDbConnectionConfig> = {}): IDbConnectionConfig => ({
  name: "postgres",
  driver: "pg",
  host: "localhost",
  port: 5432,
  ...overrides,
});

describe("DbManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    DbManager.reset();
  });

  afterEach(() => {
    DbManager.reset();
  });

  describe("getInstance()", () => {
    it("returns the same instance on repeated calls", () => {
      const a = DbManager.getInstance();
      const b = DbManager.getInstance();
      expect(a).toBe(b);
    });

    it("returns a fresh instance after reset()", () => {
      const a = DbManager.getInstance();
      DbManager.reset();
      const b = DbManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe("initialize()", () => {
    it("calls AdapterFactory.create for each config", async () => {
      await DbManager.getInstance().initialize([mongoConfig()]);
      expect(AdapterFactory.create).toHaveBeenCalledTimes(1);
    });

    it("calls AdapterFactory.create for every config in the array", async () => {
      await DbManager.getInstance().initialize([mongoConfig(), pgConfig()]);
      expect(AdapterFactory.create).toHaveBeenCalledTimes(2);
    });

    it("connects to all registered adapters", async () => {
      await DbManager.getInstance().initialize([mongoConfig(), pgConfig()]);
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it("throws when configs array is empty", async () => {
      await expect(DbManager.getInstance().initialize([])).rejects.toThrow(
        /No database configurations/i
      );
    });

    it("throws when more than one config is marked isDefault", async () => {
      await expect(
        DbManager.getInstance().initialize([
          mongoConfig({ isDefault: true }),
          pgConfig({ isDefault: true }),
        ])
      ).rejects.toThrow(/Multiple default/i);
    });

    it("auto-sets first config as default when none is marked", async () => {
      await DbManager.getInstance().initialize([mongoConfig({ isDefault: false })]);

      const def = DbManager.getInstance().registry.getDefault();
      expect(def.name).toBe("mongodb");
    });

    it("is idempotent -- second call is a no-op", async () => {
      const manager = DbManager.getInstance();
      await manager.initialize([mongoConfig()]);
      await manager.initialize([mongoConfig()]);

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it("re-throws when AdapterFactory.create throws", async () => {
      vi.mocked(AdapterFactory.create).mockImplementationOnce(() => {
        throw new Error("Unsupported driver");
      });

      await expect(
        DbManager.getInstance().initialize([mongoConfig()])
      ).rejects.toThrow("Unsupported driver");
    });

    it("allows re-initialization after reset and shutdown", async () => {
      const manager = DbManager.getInstance();
      await manager.initialize([mongoConfig()]);
      await manager.shutdown();

      // reset() discards the singleton (and its registry), giving a clean slate
      DbManager.reset();
      vi.clearAllMocks();

      const fresh = DbManager.getInstance();
      await expect(fresh.initialize([mongoConfig()])).resolves.toBeUndefined();
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("shutdown()", () => {
    it("disconnects all adapters", async () => {
      const manager = DbManager.getInstance();
      await manager.initialize([mongoConfig(), pgConfig()]);
      await manager.shutdown();

      expect(mockDisconnect).toHaveBeenCalledTimes(2);
    });

    it("allows initialize() again after reset() and shutdown()", async () => {
      const manager = DbManager.getInstance();
      await manager.initialize([mongoConfig()]);
      await manager.shutdown();

      // A new singleton has a fresh DbRegistry with no registered adapters
      DbManager.reset();
      vi.clearAllMocks();

      const fresh = DbManager.getInstance();
      await fresh.initialize([mongoConfig()]);
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("healthCheck()", () => {
    it("returns a map of connection name to ping result", async () => {
      const manager = DbManager.getInstance();
      await manager.initialize([mongoConfig(), pgConfig()]);

      const health = await manager.healthCheck();

      expect(health).toHaveProperty("mongodb", true);
      expect(health).toHaveProperty("postgres", true);
    });
  });

  describe("bindModel() / resolveForModel()", () => {
    it("resolves a bound model to the specified adapter", async () => {
      const manager = DbManager.getInstance();
      await manager.initialize([mongoConfig(), pgConfig()]);

      manager.bindModel({ modelName: "UserModel", connectionName: "mongodb" });

      const adapter = manager.resolveForModel("UserModel");
      expect(adapter.name).toBe("mongodb");
    });

    it("resolves an unbound model to the default adapter", async () => {
      const manager = DbManager.getInstance();
      await manager.initialize([mongoConfig(), pgConfig()]);

      const adapter = manager.resolveForModel("AnonymousModel");
      expect(adapter.name).toBe("mongodb");
    });

    it("reflects a rebind immediately", async () => {
      const manager = DbManager.getInstance();
      await manager.initialize([mongoConfig(), pgConfig()]);

      manager.bindModel({ modelName: "UserModel", connectionName: "mongodb" });
      manager.bindModel({ modelName: "UserModel", connectionName: "postgres" });

      const adapter = manager.resolveForModel("UserModel");
      expect(adapter.name).toBe("postgres");
    });
  });

  describe("registry and resolver", () => {
    it("exposes the registry with all registered connections", async () => {
      const manager = DbManager.getInstance();
      await manager.initialize([mongoConfig(), pgConfig()]);

      expect(manager.registry.list()).toContain("mongodb");
      expect(manager.registry.list()).toContain("postgres");
    });

    it("exposes the resolver with listBindings()", async () => {
      const manager = DbManager.getInstance();
      await manager.initialize([mongoConfig()]);
      manager.bindModel({ modelName: "PostModel", connectionName: "mongodb" });

      expect(manager.resolver.listBindings()).toContainEqual({
        modelName: "PostModel",
        connectionName: "mongodb",
      });
    });
  });
});
