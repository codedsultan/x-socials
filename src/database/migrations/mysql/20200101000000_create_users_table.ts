/**
 * @file src/database/migrations/mysql/20200101000000_create_users_table.ts
 * @description Users table — MySQL dialect.
 *
 *  MySQL differences vs Postgres:
 *    - Uses `text` instead of `string(1000)` for long fields (password, salt)
 *    - No `returning()` support — separate SELECT after INSERT needed
 *    - Self-referential FK (banned_by_id) must be added in a second ALTER
 *      because MySQL evaluates constraints at table-creation time
 *    - FULLTEXT index syntax differs; handled via raw() call
 */

import type { Knex } from "knex";

const TABLE = "users";

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(TABLE);
  if (exists) return;

  // Step 1: create table WITHOUT the self-referential FK
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
    t.text("password").notNullable();      // text — bcrypt/pbkdf2 hashes
    t.text("salt").nullable();
    t.dateTime("password_changed_at").nullable();

    t.enu("role", ["user", "admin"]).notNullable().defaultTo("user");

    t.boolean("banned").notNullable().defaultTo(false);
    t.integer("banned_by_id").unsigned().nullable(); // FK added in Step 2

    t.enu("account_status", ["active", "suspended", "deactivated"])
      .notNullable()
      .defaultTo("active");

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

  // Step 2: add self-referential FK and indexes in ALTER statements
  await knex.schema.alterTable(TABLE, (t) => {
    t.foreign("banned_by_id").references("id").inTable(TABLE).onDelete("SET NULL");
    t.index(["email"], "idx_users_email");
    t.index(["username"], "idx_users_username");
    t.index(["role"], "idx_users_role");
    t.index(["account_status"], "idx_users_account_status");
    t.index(["banned"], "idx_users_banned");
    t.index(["verification_token"], "idx_users_verification_token");
    t.index(["reset_password_token"], "idx_users_reset_password_token");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}
