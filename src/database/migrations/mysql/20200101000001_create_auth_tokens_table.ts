/**
 * @file src/database/migrations/mysql/20200101000001_create_auth_tokens_table.ts
 */
import type { Knex } from "knex";
const TABLE = "auth_tokens";
export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) return;
  await knex.schema.createTable(TABLE, (t) => {
    t.increments("id").primary();
    t.text("token").notNullable();
    t.integer("user_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("CASCADE");
    t.bigInteger("expires_at").notNullable();
    t.timestamps(false, true);
  });
  await knex.schema.alterTable(TABLE, (t) => {
    t.index(["user_id"], "idx_auth_tokens_user_id");
    t.index(["expires_at"], "idx_auth_tokens_expires_at");
  });
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}
