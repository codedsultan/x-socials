import { describe, it, expect, vi } from "vitest";
import type { IDbConnectionConfig } from "../../interfaces/core/database";

// To mock a class used with `new`, provide a real class (not an arrow function)
// inside the vi.mock factory. The spy is accessed via the imported binding after
// mocking so we can assert on call args.
vi.mock("./adapters/MongooseAdapter", () => ({
  MongooseAdapter: class {
    name: string;
    driver = "mongoose";
    constructor(public config: IDbConnectionConfig) {
      this.name = config.name;
    }
  },
}));

vi.mock("./adapters/KnexAdapter", () => ({
  KnexAdapter: class {
    name: string;
    driver: string;
    constructor(public config: IDbConnectionConfig) {
      this.name = config.name;
      this.driver = config.driver;
    }
  },
}));

import { AdapterFactory } from "./AdapterFactory";
import { MongooseAdapter } from "./adapters/MongooseAdapter";
import { KnexAdapter } from "./adapters/KnexAdapter";

const cfg = (driver: IDbConnectionConfig["driver"], name = "conn"): IDbConnectionConfig => ({
  name,
  driver,
});

describe("AdapterFactory", () => {
  describe("create()", () => {
    describe("MongoDB drivers", () => {
      it("creates a MongooseAdapter for 'mongoose' driver", () => {
        const adapter = AdapterFactory.create(cfg("mongoose", "m1"));
        expect(adapter).toBeInstanceOf(MongooseAdapter);
        expect(adapter.driver).toBe("mongoose");
        expect(adapter.name).toBe("m1");
      });

      it("creates a MongooseAdapter for 'mongodb' driver", () => {
        const adapter = AdapterFactory.create(cfg("mongodb", "m2"));
        expect(adapter).toBeInstanceOf(MongooseAdapter);
        expect(adapter.name).toBe("m2");
      });

      it("passes the full config object to MongooseAdapter", () => {
        const config = cfg("mongoose", "my-mongo");
        const adapter = AdapterFactory.create(config) as any;
        expect(adapter.config).toBe(config);
      });
    });

    describe("Relational drivers", () => {
      it.each([
        ["pg"],
        ["pg-native"],
        ["mysql"],
        ["mysql2"],
        // ["sqlite3"],
        ["better-sqlite3"],
        ["knex"],
      ] as [IDbConnectionConfig["driver"]][])(
        "creates a KnexAdapter for '%s' driver",
        (driver) => {
          const adapter = AdapterFactory.create(cfg(driver));
          expect(adapter).toBeInstanceOf(KnexAdapter);
          expect(adapter.driver).toBe(driver);
        }
      );

      it("passes the full config object to KnexAdapter", () => {
        const config = cfg("pg", "my-pg");
        const adapter = AdapterFactory.create(config) as any;
        expect(adapter.config).toBe(config);
      });
    });

    describe("Unsupported drivers", () => {
      it("throws for an unsupported driver", () => {
        expect(() =>
          AdapterFactory.create({ name: "bad", driver: "oracle" } as any)
        ).toThrow(/Unsupported driver/i);
      });

      it("error message includes the offending driver name", () => {
        expect(() =>
          AdapterFactory.create({ name: "bad", driver: "redis" } as any)
        ).toThrow("redis");
      });

      it("throws for an empty string driver", () => {
        expect(() =>
          AdapterFactory.create({ name: "bad", driver: "" } as any)
        ).toThrow(/Unsupported driver/i);
      });
    });
  });
});