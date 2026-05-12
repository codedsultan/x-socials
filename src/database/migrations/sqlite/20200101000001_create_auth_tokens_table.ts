/**
 * @file src/database/migrations/sqlite/20200101000004_create_auth_tokens_table.ts
 */

import type { Knex } from "knex";

const TABLE = "auth_tokens";

export async function up(knex: Knex): Promise<void> {
  await knex.raw("PRAGMA foreign_keys = ON");
  if (await knex.schema.hasTable(TABLE)) return;

  await knex.schema.createTable(TABLE, (t) => {
    t.increments("id").primary();
    t.string("token", 1000).notNullable().unique();
    t.integer("user_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("CASCADE");
    t.enu("type", ["access", "refresh", "reset_password", "email_verification"])
      .notNullable().defaultTo("access");
    t.bigInteger("expires_at").notNullable();
    t.timestamps(false, true);
  });

  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_user_id ON ${TABLE}(user_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_token ON ${TABLE}(token)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_expires_at ON ${TABLE}(expires_at)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_user_type ON ${TABLE}(user_id, type)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}