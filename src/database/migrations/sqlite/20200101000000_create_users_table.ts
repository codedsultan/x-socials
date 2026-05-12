/**
 * @file src/database/migrations/sqlite/20200101000000_create_users_table.ts
 * @description Users table — SQLite dialect.
 *
 *  SQLite differences:
 *    - No native enum type → use CHECK constraints
 *    - No ALTER TABLE ADD FOREIGN KEY → all FKs declared at creation
 *    - Self-referential FK (banned_by_id) is deferred
 *    - PRAGMA foreign_keys must be ON (enabled in KnexAdapter for SQLite)
 *    - `useNullAsDefault: true` required in knex config (already set in knexfile.ts)
 */

import type { Knex } from "knex";

const TABLE = "users";

export async function up(knex: Knex): Promise<void> {
  // Enable FK support for this connection (SQLite-specific)
  await knex.raw("PRAGMA foreign_keys = ON");

  if (await knex.schema.hasTable(TABLE)) return;

  await knex.schema.createTable(TABLE, (t) => {
    t.increments("id").primary();

    t.string("fname", 100).notNullable();
    t.string("lname", 100).notNullable();
    t.string("email", 100).notNullable().unique();
    t.boolean("is_email_verified").notNullable().defaultTo(false);
    t.dateTime("email_changed_at").nullable();

    t.string("username", 100).notNullable().unique();
    t.dateTime("username_changed_at").nullable();
    t.dateTime("name_changed_at").nullable();

    t.string("apikey", 255).nullable();
    t.string("password", 1000).notNullable();
    t.string("salt", 1000).nullable();
    t.dateTime("password_changed_at").nullable();

    // SQLite has no native ENUM; Knex emits a VARCHAR + CHECK
    t.enu("role", ["user", "admin"]).notNullable().defaultTo("user");

    t.boolean("banned").notNullable().defaultTo(false);
    // Deferred self-referential FK — supported in SQLite
    t.integer("banned_by_id").unsigned().nullable()
      .references("id").inTable(TABLE).deferrable("deferred");

    t.enu("account_status", ["active", "suspended", "deactivated"])
      .notNullable().defaultTo("active");

    t.boolean("is_verified").notNullable().defaultTo(false);
    t.boolean("verified").notNullable().defaultTo(false);
    t.dateTime("verification_expires").nullable();
    t.string("verification_token", 255).nullable();

    t.dateTime("reset_password_expires").nullable();
    t.string("reset_password_token", 255).nullable();

    t.dateTime("change_email_expires").nullable();
    t.string("change_email_token", 255).nullable();
    t.string("change_email_address", 100).nullable();

    t.string("country_code", 20).nullable();
    t.string("phone", 10).nullable();
    t.boolean("is_phone_verified").notNullable().defaultTo(false);
    t.dateTime("phone_changed_at").nullable();

    t.string("avatar_public_id", 100).nullable();
    t.string("avatar_url", 500).nullable();

    t.string("gender", 100).nullable();
    t.string("dob", 100).nullable();
    t.string("about", 1000).nullable();
    t.string("profession", 100).nullable();
    t.string("location", 100).nullable();
    t.string("website", 100).nullable();

    t.boolean("is_private").notNullable().defaultTo(false);

    t.timestamps(false, true);
  });

  // SQLite supports indexes via CREATE INDEX
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_users_email ON ${TABLE}(email)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_users_username ON ${TABLE}(username)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_users_role ON ${TABLE}(role)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_users_account_status ON ${TABLE}(account_status)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_users_banned ON ${TABLE}(banned)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}
