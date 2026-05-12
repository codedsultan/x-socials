/**
 * @file src/database/migrations/postgres/20200101000003_create_posts_table.ts
 * @description Create posts table with content, media, and metadata support (PostgreSQL)
 */

import type { Knex } from "knex";

const TABLE = "posts";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE, (t) => {
    t.increments("id").primary();
    t.integer("user_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("CASCADE");
    t.text("content").notNullable();
    t.specificType("media_urls", "TEXT[]").nullable(); // PostgreSQL array type
    t.enu("status", ["active", "inactive", "deleted"]).notNullable().defaultTo("active");
    t.jsonb("metadata").nullable().defaultTo(JSON.stringify({
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0
    }));
    t.timestamp("deleted_at").nullable(); // For soft deletes
    t.timestamps(false, true);
  });

  // Indexes for performance
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_posts_user_id ON ${TABLE}(user_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_posts_status ON ${TABLE}(status)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON ${TABLE}(created_at)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON ${TABLE}(deleted_at)`);

  // Composite index
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_posts_user_status ON ${TABLE}(user_id, status)`);

  // GIN index for JSONB metadata queries (PostgreSQL specific)
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_posts_metadata ON ${TABLE} USING GIN(metadata)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}