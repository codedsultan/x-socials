/**
 * @file src/database/migrations/sqlite/20200101000005_create_otps_table.ts
 */

import type { Knex } from "knex";

const TABLE = "otps";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("PRAGMA foreign_keys = ON");
  if (await knex.schema.hasTable(TABLE)) return;

  await knex.schema.createTable(TABLE, (t) => {
    t.increments("id").primary();
    t.string("otp", 10).notNullable();
    t.enu("type", ["email_verification", "phone_verification", "password_reset", "login"])
      .notNullable().defaultTo("email_verification");
    t.datetime("expires_at").notNullable();
    t.string("email", 255).nullable();
    t.string("phone", 20).nullable();
    t.integer("user_id").unsigned().nullable()
      .references("id").inTable("users").onDelete("CASCADE");
    t.boolean("is_used").notNullable().defaultTo(false);
    t.integer("attempts").notNullable().defaultTo(0);
    t.timestamps(false, true);
  });

  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_otp ON ${TABLE}(otp)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_user_id ON ${TABLE}(user_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_email ON ${TABLE}(email)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_phone ON ${TABLE}(phone)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_expires_at ON ${TABLE}(expires_at)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_type_unused ON ${TABLE}(type, is_used)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}