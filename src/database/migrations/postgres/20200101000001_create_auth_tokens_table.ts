/**
 * @file src/database/migrations/postgres/20200101000001_create_auth_tokens_table.ts
 * @description Creates the `auth_tokens` table used to store JWT sessions.
 */

import type { Knex } from "knex";

const TABLE = "auth_tokens";

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(TABLE);
  if (exists) return;

  await knex.schema.createTable(TABLE, (t) => {
    t.increments("id").primary();
    t.string("token", 1000).notNullable().unique(); // Added unique constraint
    t.integer("user_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    t.enu("type", ["access", "refresh", "reset_password", "email_verification"])
      .notNullable()
      .defaultTo("access"); // Added token type
    t.bigInteger("expires_at").notNullable(); // Unix timestamp (milliseconds for consistency)
    t.timestamps(false, true);
  });

  // Create indexes for performance
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_user_id ON ${TABLE}(user_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_token ON ${TABLE}(token)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_expires_at ON ${TABLE}(expires_at)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_user_type ON ${TABLE}(user_id, type)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_type_expires ON ${TABLE}(type, expires_at)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}