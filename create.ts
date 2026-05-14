// scripts/migrations/create.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MigrationFile {
    fileName: string;
    template: string;
}

function generateMigrationTemplate(name: string): MigrationFile {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
    const fileName = `${timestamp}_${name}.ts`;

    const template = `import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('${name}', (table) => {
        table.string('id', 36).primary();
        table.timestamps(true, true);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('${name}');
}
`;

    return { fileName, template };
}

async function createMigration(): Promise<void> {
    const migrationName = process.argv[2];

    if (!migrationName) {
        console.error('❌ Please provide a migration name');
        console.log('Usage: pnpm migrate:create <migration_name>');
        console.log('Example: pnpm migrate:create create_users_table');
        process.exit(1);
    }

    const migrationsDir = path.join(__dirname, '../../src/database/migrations');

    // Create migrations directory if it doesn't exist
    if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
        console.log(`📁 Created migrations directory: ${migrationsDir}`);
    }

    const { fileName, template } = generateMigrationTemplate(migrationName);
    const filePath = path.join(migrationsDir, fileName);

    // Check if migration already exists
    if (fs.existsSync(filePath)) {
        console.error(`❌ Migration ${fileName} already exists`);
        process.exit(1);
    }

    // Write migration file
    fs.writeFileSync(filePath, template);
    console.log(`✅ Created migration: ${fileName}`);
    console.log(`📍 Location: ${filePath}`);
    console.log('\n📝 Next steps:');
    console.log(`   1. Edit the migration file to add your schema changes`);
    console.log(`   2. Run: pnpm migrate:up`);
}

createMigration().catch((error: unknown) => {
    console.error('Failed to create migration:', error instanceof Error ? error.message : error);
    process.exit(1);
});