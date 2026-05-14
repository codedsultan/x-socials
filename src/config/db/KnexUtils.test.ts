import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TimestampPrecision } from "./KnexUtils";

// Build a minimal Knex-shaped stub.
// raw() is what we assert on — it must capture (sql, bindings) and return an
// object that carries them so tests can inspect without a real DB.
const makeKnexStub = (driverName: string) => {
  const raw = vi.fn((sql: string, bindings?: unknown[]) => ({ sql, bindings }));
  return {
    client: { driverName },
    raw,
  } as any;
};

import { KnexUtils } from "./KnexUtils";

const ALL_PRECISIONS: TimestampPrecision[] = ["second", "minute", "hour", "day"];

describe("KnexUtils", () => {
  describe("constructor", () => {
    it("accepts a Knex instance without throwing", () => {
      expect(() => new KnexUtils(makeKnexStub("pg"))).not.toThrow();
    });
  });

  describe("truncatedTimestamp()", () => {
    describe("PostgreSQL — pg", () => {
      let utils: KnexUtils;
      let knex: ReturnType<typeof makeKnexStub>;

      beforeEach(() => {
        knex = makeKnexStub("pg");
        utils = new KnexUtils(knex);
      });

      it("calls knex.raw with date_trunc pattern", () => {
        utils.truncatedTimestamp("created_at", "hour");
        expect(knex.raw).toHaveBeenCalledWith(
          expect.stringContaining("date_trunc"),
          expect.any(Array)
        );
      });

      it("passes precision as first binding", () => {
        utils.truncatedTimestamp("created_at", "day");
        const [, bindings] = knex.raw.mock.calls[0];
        expect(bindings[0]).toBe("day");
      });

      it("passes column name as second binding", () => {
        utils.truncatedTimestamp("e.created_at", "hour");
        const [, bindings] = knex.raw.mock.calls[0];
        expect(bindings[1]).toBe("e.created_at");
      });

      it("includes UTC timezone in the SQL", () => {
        utils.truncatedTimestamp("ts", "minute");
        const [sql] = knex.raw.mock.calls[0];
        expect(sql.toLowerCase()).toContain("utc");
      });

      it.each(ALL_PRECISIONS)("handles '%s' precision", (p) => {
        expect(() => utils.truncatedTimestamp("ts", p)).not.toThrow();
        const [, bindings] = knex.raw.mock.calls[0];
        expect(bindings[0]).toBe(p);
      });

      it("defaults to 'hour' precision when none supplied", () => {
        utils.truncatedTimestamp("ts");
        const [, bindings] = knex.raw.mock.calls[0];
        expect(bindings[0]).toBe("hour");
      });
    });

    describe("PostgreSQL — pg-native", () => {
      it("uses the same date_trunc pattern as pg", () => {
        const knex = makeKnexStub("pg-native");
        const utils = new KnexUtils(knex);

        utils.truncatedTimestamp("created_at", "hour");
        const [sql] = knex.raw.mock.calls[0];
        expect(sql).toContain("date_trunc");
      });
    });

    describe("MySQL — mysql", () => {
      let utils: KnexUtils;
      let knex: ReturnType<typeof makeKnexStub>;

      beforeEach(() => {
        knex = makeKnexStub("mysql");
        utils = new KnexUtils(knex);
      });

      it("calls knex.raw with DATE_FORMAT pattern", () => {
        utils.truncatedTimestamp("created_at", "hour");
        const [sql] = knex.raw.mock.calls[0];
        expect(sql).toContain("DATE_FORMAT");
      });

      it("wraps result in CAST ... AS DATETIME for type consistency", () => {
        utils.truncatedTimestamp("created_at", "hour");
        const [sql] = knex.raw.mock.calls[0];
        expect(sql).toContain("CAST");
        expect(sql).toContain("DATETIME");
      });

      it("uses hour format '%Y-%m-%d %H:00:00' for hour precision", () => {
        utils.truncatedTimestamp("ts", "hour");
        const [, bindings] = knex.raw.mock.calls[0];
        expect(bindings[1]).toBe("%Y-%m-%d %H:00:00");
      });

      it("uses minute format '%Y-%m-%d %H:%i:00' for minute precision", () => {
        utils.truncatedTimestamp("ts", "minute");
        const [, bindings] = knex.raw.mock.calls[0];
        expect(bindings[1]).toBe("%Y-%m-%d %H:%i:00");
      });

      it("uses second format '%Y-%m-%d %H:%i:%s' for second precision", () => {
        utils.truncatedTimestamp("ts", "second");
        const [, bindings] = knex.raw.mock.calls[0];
        expect(bindings[1]).toBe("%Y-%m-%d %H:%i:%s");
      });

      it("uses day format '%Y-%m-%d 00:00:00' for day precision", () => {
        utils.truncatedTimestamp("ts", "day");
        const [, bindings] = knex.raw.mock.calls[0];
        expect(bindings[1]).toBe("%Y-%m-%d 00:00:00");
      });

      it("passes column name as first binding", () => {
        utils.truncatedTimestamp("orders.created_at", "day");
        const [, bindings] = knex.raw.mock.calls[0];
        expect(bindings[0]).toBe("orders.created_at");
      });
    });

    describe("MySQL — mysql2", () => {
      it("uses the same DATE_FORMAT pattern as mysql", () => {
        const knex = makeKnexStub("mysql2");
        const utils = new KnexUtils(knex);

        utils.truncatedTimestamp("ts", "hour");
        const [sql] = knex.raw.mock.calls[0];
        expect(sql).toContain("DATE_FORMAT");
      });
    });

    // describe("SQLite — sqlite3", () => {
    //   let utils: KnexUtils;
    //   let knex: ReturnType<typeof makeKnexStub>;

    //   beforeEach(() => {
    //     knex = makeKnexStub("sqlite3");
    //     utils = new KnexUtils(knex);
    //   });

    //   it("calls knex.raw with strftime pattern", () => {
    //     utils.truncatedTimestamp("created_at", "hour");
    //     const [sql] = knex.raw.mock.calls[0];
    //     expect(sql).toContain("strftime");
    //   });

    //   it("passes the format string as first binding", () => {
    //     utils.truncatedTimestamp("ts", "hour");
    //     const [, bindings] = knex.raw.mock.calls[0];
    //     expect(bindings[0]).toBe("%Y-%m-%d %H:00:00");
    //   });

    //   it("passes column name as second binding", () => {
    //     utils.truncatedTimestamp("ts", "day");
    //     const [, bindings] = knex.raw.mock.calls[0];
    //     expect(bindings[1]).toBe("ts");
    //   });

    //   it("uses hour format '%Y-%m-%d %H:00:00'", () => {
    //     utils.truncatedTimestamp("ts", "hour");
    //     const [, bindings] = knex.raw.mock.calls[0];
    //     expect(bindings[0]).toBe("%Y-%m-%d %H:00:00");
    //   });

    //   it("uses minute format '%Y-%m-%d %H:%M:00'", () => {
    //     utils.truncatedTimestamp("ts", "minute");
    //     const [, bindings] = knex.raw.mock.calls[0];
    //     expect(bindings[0]).toBe("%Y-%m-%d %H:%M:00");
    //   });

    //   it("uses second format '%Y-%m-%d %H:%M:%S'", () => {
    //     utils.truncatedTimestamp("ts", "second");
    //     const [, bindings] = knex.raw.mock.calls[0];
    //     expect(bindings[0]).toBe("%Y-%m-%d %H:%M:%S");
    //   });

    //   it("uses day format '%Y-%m-%d 00:00:00'", () => {
    //     utils.truncatedTimestamp("ts", "day");
    //     const [, bindings] = knex.raw.mock.calls[0];
    //     expect(bindings[0]).toBe("%Y-%m-%d 00:00:00");
    //   });
    // });

    describe("SQLite — better-sqlite3", () => {
      it("uses the same strftime pattern as sqlite3", () => {
        const knex = makeKnexStub("better-sqlite3");
        const utils = new KnexUtils(knex);

        utils.truncatedTimestamp("ts", "hour");
        const [sql] = knex.raw.mock.calls[0];
        expect(sql).toContain("strftime");
      });
    });

    describe("Unsupported drivers", () => {
      it.each(["mssql", "oracle", "oracledb", "cockroachdb", ""])(
        "throws for unsupported driver '%s'",
        (driver) => {
          const knex = makeKnexStub(driver);
          const utils = new KnexUtils(knex);
          expect(() => utils.truncatedTimestamp("ts", "hour")).toThrow(
            /not supported for driver/i
          );
        }
      );

      it("includes the offending driver name in the error message", () => {
        const knex = makeKnexStub("mssql");
        const utils = new KnexUtils(knex);
        expect(() => utils.truncatedTimestamp("ts")).toThrow("mssql");
      });

      it("includes the list of supported drivers in the error message", () => {
        const knex = makeKnexStub("oracle");
        const utils = new KnexUtils(knex);
        expect(() => utils.truncatedTimestamp("ts")).toThrow(/pg/);
      });
    });

    describe("Default precision", () => {
      it("defaults to hour when no precision argument is passed", () => {
        const knex = makeKnexStub("pg");
        const utils = new KnexUtils(knex);

        utils.truncatedTimestamp("ts");
        const [, bindings] = knex.raw.mock.calls[0];
        expect(bindings[0]).toBe("hour");
      });
    });

    describe("Return value", () => {
      it("returns the value produced by knex.raw (a Knex.Raw object)", () => {
        const knex = makeKnexStub("pg");
        const utils = new KnexUtils(knex);
        const result = utils.truncatedTimestamp("ts", "hour");

        // Our stub returns { sql, bindings } — confirm we get something back
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
      });
    });
  });
});
