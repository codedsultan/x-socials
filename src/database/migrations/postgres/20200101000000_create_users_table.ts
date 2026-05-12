/**
 * @file src/database/migrations/postgres/20200101000000_create_users_table.ts
 * @description Initial users table migration — PostgreSQL dialect.
 *
 *  Creates the canonical users table with:
 *    - Identity fields (fname, lname, email, username)
 *    - Authentication fields (password, salt, apikey)
 *    - Role-based access control (role)
 *    - Account status & verification
 *    - Profile fields (avatar, bio, gender, dob …)
 *    - Email-change / password-reset / verification token flows
 *    - Soft-ban support (banned, banned_by_id)
 *    - Timestamps (created_at, updated_at)
 *
 *  This migration supersedes the old plain-JS mysql migrations:
 *    - 20200211220920_constraints.js  (stub — never created the table)
 *    - 20200810195255_change_email.js (change_email columns now included here)
 *    - 20241103083933_user-roles.js   (role column now included here)
 */

import type { Knex } from "knex";

const TABLE = "users";

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(TABLE);
  if (exists) return;

  await knex.schema.createTable(TABLE, (t) => {
    // ── Primary key ─────────────────────────────────────────────────────
    t.increments("id").primary();

    // ── Identity ─────────────────────────────────────────────────────────
    t.string("fname", 100).notNullable();
    t.string("lname", 100).notNullable();
    t.string("email", 100).notNullable().unique();
    t.boolean("is_email_verified").notNullable().defaultTo(false);
    t.dateTime("email_changed_at").nullable();

    t.string("username", 100).notNullable().unique();
    t.dateTime("username_changed_at").nullable();
    t.dateTime("name_changed_at").nullable();

    // ── Auth ──────────────────────────────────────────────────────────────
    t.string("apikey", 255).nullable();
    t.string("password", 1000).notNullable();
    // t.string("salt", 1000).nullable();
    t.dateTime("password_changed_at").nullable();

    // ── Role ──────────────────────────────────────────────────────────────
    t.enu("role", ["user", "admin"]).notNullable().defaultTo("user");

    // ── Ban ───────────────────────────────────────────────────────────────
    t.boolean("banned").notNullable().defaultTo(false);
    t.integer("banned_by_id")
      .unsigned()
      .nullable()
      .references("id")
      .inTable(TABLE)
      .onDelete("SET NULL");

    // ── Account status ────────────────────────────────────────────────────
    t.enu("account_status", ["active", "suspended", "deactivated"])
      .notNullable()
      .defaultTo("active");

    // ── Verification ──────────────────────────────────────────────────────
    t.boolean("is_verified").notNullable().defaultTo(false);
    t.boolean("verified").notNullable().defaultTo(false);       // legacy compat
    t.dateTime("verification_expires").nullable();
    t.string("verification_token", 255).nullable();

    // ── Password-reset flow ───────────────────────────────────────────────
    t.dateTime("reset_password_expires").nullable();
    t.string("reset_password_token", 255).nullable();

    // ── Change-email flow ─────────────────────────────────────────────────
    t.dateTime("change_email_expires").nullable();
    t.string("change_email_token", 255).nullable();
    t.string("change_email_address", 100).nullable();

    // ── Profile ───────────────────────────────────────────────────────────
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

    // ── Timestamps ────────────────────────────────────────────────────────
    t.timestamps(false, true); // created_at, updated_at with defaults
  });

  // ── Indexes ───────────────────────────────────────────────────────────────
  await knex.schema.alterTable(TABLE, (t) => {
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
