/**
 * @file src/database/migrations/mysql/20200101000003_create_posts_table.ts
 */
import type { Knex } from "knex";
const TABLE = "posts";
export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) return;
  await knex.schema.createTable(TABLE, (t) => {
    t.increments("id").primary();
    t.integer("user_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("CASCADE");
    t.enu("status", ["active", "inactive", "deleted"]).notNullable().defaultTo("active");
    t.timestamps(false, true);
  });
  await knex.schema.alterTable(TABLE, (t) => {
    t.index(["user_id"], "idx_posts_user_id");
    t.index(["status"], "idx_posts_status");
  });
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}
