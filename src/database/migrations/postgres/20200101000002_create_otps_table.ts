/**
 * @file src/database/migrations/postgres/20200101000002_create_otps_table.ts
 * @description Creates the `otps` table for phone/email one-time passwords.
 */

import type { Knex } from "knex";

const TABLE = "otps";

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable(TABLE);
  if (exists) return;

  await knex.schema.createTable(TABLE, (t) => {
    t.increments("id").primary();
    t.string("otp", 10).notNullable();
    t.enu("type", ["email_verification", "phone_verification", "password_reset", "login"])
      .notNullable()
      .defaultTo("email_verification"); // Added OTP type
    t.timestamp("expires_at").notNullable(); // Changed to timestamp for consistency
    t.string("email", 255).nullable(); // Increased length
    t.string("phone", 20).nullable(); // Increased length for international numbers
    t.integer("user_id")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    t.boolean("is_used").notNullable().defaultTo(false);
    t.integer("attempts").notNullable().defaultTo(0); // Added attempts counter
    t.timestamps(false, true);
  });

  // Create indexes for performance
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_otp ON ${TABLE}(otp)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_user_id ON ${TABLE}(user_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_email ON ${TABLE}(email)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_phone ON ${TABLE}(phone)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_expires_at ON ${TABLE}(expires_at)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_type_unused ON ${TABLE}(type, is_used)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_user_type_valid ON ${TABLE}(user_id, type, is_used, expires_at)`);

  // Composite index for finding valid OTPs by email/phone
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_email_type_valid ON ${TABLE}(email, type, is_used, expires_at) WHERE email IS NOT NULL`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_${TABLE}_phone_type_valid ON ${TABLE}(phone, type, is_used, expires_at) WHERE phone IS NOT NULL`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}