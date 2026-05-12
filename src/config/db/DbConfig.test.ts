import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DbConfig } from "./DbConfig";

vi.mock("../logger", () => ({
  default: {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));



const ALL_DB_KEYS = [
  "MONGO_URI", "MONGO_DB_NAME", "MONGO_CONNECTION_NAME", "DEFAULT_DB",
  "MONGO_SOCKET_TIMEOUT_MS", "MONGO_SERVER_SELECTION_TIMEOUT_MS",
  "PG_HOST", "PG_PORT", "PG_DATABASE", "PG_USER", "PG_PASSWORD",
  "PG_SSL", "PG_CLIENT", "PG_CONNECTION_NAME", "PG_POOL_MIN", "PG_POOL_MAX",
  "MYSQL_HOST", "MYSQL_PORT", "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD",
  "MYSQL_SSL", "MYSQL_CLIENT", "MYSQL_CONNECTION_NAME",
  "SQLITE_FILENAME", "SQLITE_CLIENT", "SQLITE_CONNECTION_NAME",
  "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD",
  "DB_POOL_MIN", "DB_POOL_MAX",
];

describe("DbConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of ALL_DB_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ALL_DB_KEYS) {
      if (originalEnv[key] !== undefined) process.env[key] = originalEnv[key];
      else delete process.env[key];
    }
  });

  describe("buildAll() with no env vars", () => {
    it("throws when no database env vars are set", () => {
      expect(() => DbConfig.buildAll()).toThrow(/No database configuration/i);
    });
  });

  describe("MongoDB config", () => {
    it("produces a mongoose config when MONGO_URI is set", () => {
      process.env["MONGO_URI"] = "mongodb://localhost:27017";
      const configs = DbConfig.buildAll();

      const mongo = configs.find((c) => c.driver === "mongoose");
      expect(mongo).toBeDefined();
      expect(mongo?.uri).toBe("mongodb://localhost:27017");
    });

    it("uses MONGO_DB_NAME when provided", () => {
      process.env["MONGO_URI"] = "mongodb://localhost:27017";
      process.env["MONGO_DB_NAME"] = "my_db";

      const [mongo] = DbConfig.buildAll();
      expect(mongo?.dbName).toBe("my_db");
    });

    it("falls back to DB_NAME for dbName", () => {
      process.env["MONGO_URI"] = "mongodb://localhost:27017";
      process.env["DB_NAME"] = "fallback_db";

      const [mongo] = DbConfig.buildAll();
      expect(mongo?.dbName).toBe("fallback_db");
    });

    it("uses MONGO_CONNECTION_NAME when provided", () => {
      process.env["MONGO_URI"] = "mongodb://localhost:27017";
      process.env["MONGO_CONNECTION_NAME"] = "primary-mongo";

      const [mongo] = DbConfig.buildAll();
      expect(mongo?.name).toBe("primary-mongo");
    });

    it("defaults name to 'mongodb'", () => {
      process.env["MONGO_URI"] = "mongodb://localhost:27017";
      const [mongo] = DbConfig.buildAll();
      expect(mongo?.name).toBe("mongodb");
    });

    it("sets isDefault true when DEFAULT_DB is 'mongodb'", () => {
      process.env["MONGO_URI"] = "mongodb://localhost:27017";
      process.env["DEFAULT_DB"] = "mongodb";

      const [mongo] = DbConfig.buildAll();
      expect(mongo?.isDefault).toBe(true);
    });

    it("sets isDefault true when DEFAULT_DB is not set (first connection)", () => {
      process.env["MONGO_URI"] = "mongodb://localhost:27017";

      const [mongo] = DbConfig.buildAll();
      expect(mongo?.isDefault).toBe(true);
    });

    it("applies custom timeout values", () => {
      process.env["MONGO_URI"] = "mongodb://localhost:27017";
      process.env["MONGO_SOCKET_TIMEOUT_MS"] = "10000";
      process.env["MONGO_SERVER_SELECTION_TIMEOUT_MS"] = "2000";

      const [mongo] = DbConfig.buildAll();
      expect(mongo?.socketTimeoutMS).toBe(10_000);
      expect(mongo?.serverSelectionTimeoutMS).toBe(2_000);
    });
  });

  describe("PostgreSQL config", () => {
    const pgEnv = {
      PG_HOST: "pg-host",
      PG_PORT: "5432",
      PG_DATABASE: "pg_db",
      PG_USER: "pg_user",
      PG_PASSWORD: "pg_pass",
      PG_CLIENT: "pg",
    };

    it("produces a pg config when PG_HOST and PG_CLIENT=pg are set", () => {
      Object.assign(process.env, pgEnv);
      const configs = DbConfig.buildAll();

      const pg = configs.find((c) => c.driver === "pg");
      expect(pg).toBeDefined();
      expect(pg?.host).toBe("pg-host");
      expect(pg?.port).toBe(5432);
      expect(pg?.database).toBe("pg_db");
      expect(pg?.user).toBe("pg_user");
      expect(pg?.password).toBe("pg_pass");
    });

    it("defaults name to 'postgres'", () => {
      Object.assign(process.env, pgEnv);
      const [pg] = DbConfig.buildAll();
      expect(pg?.name).toBe("postgres");
    });

    it("uses PG_CONNECTION_NAME when provided", () => {
      Object.assign(process.env, pgEnv);
      process.env["PG_CONNECTION_NAME"] = "analytics-pg";
      const [pg] = DbConfig.buildAll();
      expect(pg?.name).toBe("analytics-pg");
    });

    it("sets ssl=true when PG_SSL=true", () => {
      Object.assign(process.env, { ...pgEnv, PG_SSL: "true" });
      const [pg] = DbConfig.buildAll();
      expect(pg?.ssl).toBe(true);
    });

    it("sets ssl=false when PG_SSL is not 'true'", () => {
      Object.assign(process.env, pgEnv);
      const [pg] = DbConfig.buildAll();
      expect(pg?.ssl).toBe(false);
    });

    it("uses pool values from env", () => {
      Object.assign(process.env, { ...pgEnv, PG_POOL_MIN: "3", PG_POOL_MAX: "20" });
      const [pg] = DbConfig.buildAll();
      expect(pg?.pool?.min).toBe(3);
      expect(pg?.pool?.max).toBe(20);
    });

    it("sets isDefault true when DEFAULT_DB=postgres", () => {
      Object.assign(process.env, pgEnv);
      process.env["DEFAULT_DB"] = "postgres";
      const configs = DbConfig.buildAll();
      const pg = configs.find((c) => c.driver === "pg");
      expect(pg?.isDefault).toBe(true);
    });

    it("sets isDefault false when DEFAULT_DB=mongodb", () => {
      process.env["MONGO_URI"] = "mongodb://localhost:27017";
      Object.assign(process.env, pgEnv);
      process.env["DEFAULT_DB"] = "mongodb";
      const configs = DbConfig.buildAll();
      const pg = configs.find((c) => c.driver === "pg");
      expect(pg?.isDefault).toBe(false);
    });

    it("falls back to DB_HOST when PG_HOST is absent but DB_HOST is set", () => {
      // Need at least one other DB so buildAll() does not throw
      process.env["MONGO_URI"] = "mongodb://localhost:27017";
      process.env["DB_HOST"] = "fallback-host";
      process.env["PG_CLIENT"] = "pg";
      const configs = DbConfig.buildAll();
      const pg = configs.find((c) => c.driver === "pg");
      expect(pg?.host).toBe("fallback-host");
    });

    it("does not produce a pg config when PG_CLIENT is mysql2", () => {
      // Add MONGO_URI so buildAll() has at least one valid config to return
      process.env["MONGO_URI"] = "mongodb://localhost:27017";
      Object.assign(process.env, { ...pgEnv, PG_CLIENT: "mysql2" });
      const configs = DbConfig.buildAll();
      expect(configs.find((c) => c.driver === "pg")).toBeUndefined();
    });

    it("does not produce a pg config when PG_HOST is missing", () => {
      const { PG_HOST: _removed, ...rest } = pgEnv;
      Object.assign(process.env, rest);
      expect(() => DbConfig.buildAll()).toThrow();
    });
  });

  describe("MySQL config", () => {
    const mysqlEnv = {
      MYSQL_HOST: "mysql-host",
      MYSQL_PORT: "3306",
      MYSQL_DATABASE: "mysql_db",
      MYSQL_USER: "root",
      MYSQL_PASSWORD: "root_pass",
      MYSQL_CLIENT: "mysql2",
    };

    it("produces a mysql2 config when MYSQL_HOST and MYSQL_CLIENT=mysql2 are set", () => {
      Object.assign(process.env, mysqlEnv);
      const configs = DbConfig.buildAll();

      const mysql = configs.find((c) => c.driver === "mysql2");
      expect(mysql).toBeDefined();
      expect(mysql?.host).toBe("mysql-host");
      expect(mysql?.port).toBe(3306);
    });

    it("defaults name to 'mysql'", () => {
      Object.assign(process.env, mysqlEnv);
      const [mysql] = DbConfig.buildAll();
      expect(mysql?.name).toBe("mysql");
    });

    it("uses MYSQL_CONNECTION_NAME when provided", () => {
      Object.assign(process.env, mysqlEnv);
      process.env["MYSQL_CONNECTION_NAME"] = "main-mysql";
      const [mysql] = DbConfig.buildAll();
      expect(mysql?.name).toBe("main-mysql");
    });

    it("sets isDefault true when DEFAULT_DB=mysql", () => {
      Object.assign(process.env, mysqlEnv);
      process.env["DEFAULT_DB"] = "mysql";
      const configs = DbConfig.buildAll();
      const mysql = configs.find((c) => c.driver === "mysql2");
      expect(mysql?.isDefault).toBe(true);
    });

    it("does not produce mysql config when MYSQL_HOST is absent", () => {
      const { MYSQL_HOST: _removed, ...rest } = mysqlEnv;
      Object.assign(process.env, rest);
      expect(() => DbConfig.buildAll()).toThrow();
    });
  });

  describe("SQLite config", () => {
    it("produces a sqlite config when SQLITE_FILENAME is set", () => {
      process.env["SQLITE_FILENAME"] = ":memory:";
      const [sqlite] = DbConfig.buildAll();

      expect(sqlite?.filename).toBe(":memory:");
      expect(sqlite?.driver).toBe("better-sqlite3");
    });

    it("uses SQLITE_CLIENT when provided", () => {
      process.env["SQLITE_FILENAME"] = "./data.db";
      process.env["SQLITE_CLIENT"] = "sqlite3";

      const [sqlite] = DbConfig.buildAll();
      expect(sqlite?.driver).toBe("sqlite3");
    });

    it("uses SQLITE_CONNECTION_NAME when provided", () => {
      process.env["SQLITE_FILENAME"] = ":memory:";
      process.env["SQLITE_CONNECTION_NAME"] = "local-db";

      const [sqlite] = DbConfig.buildAll();
      expect(sqlite?.name).toBe("local-db");
    });

    it("defaults name to 'sqlite'", () => {
      process.env["SQLITE_FILENAME"] = ":memory:";
      const [sqlite] = DbConfig.buildAll();
      expect(sqlite?.name).toBe("sqlite");
    });

    it("sets isDefault true when DEFAULT_DB=sqlite", () => {
      process.env["SQLITE_FILENAME"] = ":memory:";
      process.env["DEFAULT_DB"] = "sqlite";
      const [sqlite] = DbConfig.buildAll();
      expect(sqlite?.isDefault).toBe(true);
    });
  });

  describe("multiple connections", () => {
    it("returns configs for all configured DBs", () => {
      process.env["MONGO_URI"] = "mongodb://localhost:27017";
      process.env["PG_HOST"] = "pg-host";
      process.env["PG_CLIENT"] = "pg";
      process.env["SQLITE_FILENAME"] = ":memory:";

      const configs = DbConfig.buildAll();
      expect(configs.length).toBeGreaterThanOrEqual(3);
    });

    it("only one connection is default when DEFAULT_DB=mongodb", () => {
      process.env["MONGO_URI"] = "mongodb://localhost:27017";
      process.env["PG_HOST"] = "pg-host";
      process.env["PG_CLIENT"] = "pg";
      process.env["DEFAULT_DB"] = "mongodb";

      const configs = DbConfig.buildAll();
      const defaults = configs.filter((c) => c.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0]?.driver).toBe("mongoose");
    });
  });
});
