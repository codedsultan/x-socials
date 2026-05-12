/**
 * @file src/database/migrations/mysql/20200101000002_create_otps_table.ts
 */
import type { Knex } from "knex";
const TABLE = "otps";
export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) return;
  await knex.schema.createTable(TABLE, (t) => {
    t.increments("id").primary();
    t.string("otp", 10).notNullable();
    t.dateTime("expires_at").notNullable();
    t.string("email", 100).nullable();
    t.string("phone", 10).nullable();
    t.integer("user_id").unsigned().nullable()
      .references("id").inTable("users").onDelete("CASCADE");
    t.boolean("is_used").notNullable().defaultTo(false);
    t.timestamps(false, true);
  });
  await knex.schema.alterTable(TABLE, (t) => {
    t.index(["user_id"], "idx_otps_user_id");
    t.index(["email"], "idx_otps_email");
    t.index(["expires_at"], "idx_otps_expires_at");
  });
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}
