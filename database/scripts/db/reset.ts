// scripts/db/reset.ts (using spawn for better output)
import { spawn } from 'child_process';
import { ConfigService } from '../../../src/config/config.service';

async function runCommand(command: string, args: string[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            stdio: 'inherit',
            shell: true,
            env: process.env
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });

        proc.on('error', (err) => {
            reject(err);
        });
    });
}

async function checkDatabaseExists(): Promise<boolean> {
    const dbConfig = ConfigService.getDatabaseConfig();
    return !!(dbConfig.sqlite || dbConfig.mysql || dbConfig.postgres);
}

async function reset(): Promise<void> {
    console.log('🔄 Resetting database...\n');

    const args = process.argv.slice(2);
    const skipSeed = args.includes('--no-seed') || args.includes('-ns');
    const dropOnly = args.includes('--drop-only') || args.includes('-do');
    const force = args.includes('--force') || args.includes('-f');

    const hasDatabases = await checkDatabaseExists();
    if (!hasDatabases) {
        console.log('ℹ️  No databases configured. Run pnpm db:setup first.');
        process.exit(0);
    }

    if (dropOnly) {
        console.log('📌 Dropping tables only...');
        await runCommand('pnpm', ['db:drop']);
        console.log('\n✅ Tables dropped!');
        console.log('\n💡 To recreate tables, run: pnpm migrate:up');
        return;
    }

    if (process.env.NODE_ENV === 'production' && !force) {
        console.error('❌ Cannot reset database in production! Use --force to override.');
        process.exit(1);
    }

    console.log('📌 Step 1/3: Dropping all tables...');
    try {
        await runCommand('pnpm', ['db:drop']);
    } catch (error) {
        console.error('Failed to drop tables:', error);
        process.exit(1);
    }

    console.log('\n📌 Step 2/3: Running migrations...');
    try {
        await runCommand('pnpm', ['migrate:up']);
    } catch (error) {
        console.error('Failed to run migrations:', error);
        process.exit(1);
    }

    if (!skipSeed) {
        console.log('\n📌 Step 3/3: Seeding data...');
        try {
            await runCommand('pnpm', ['db:seed']);
        } catch (error) {
            console.error('Failed to seed database:', error);
            process.exit(1);
        }
    } else {
        console.log('\n📌 Step 3/3: Skipping seed (--no-seed flag)');
    }

    console.log('\n✅ Database reset complete!');
    console.log('\n💡 Tips:');
    console.log('   • Add --no-seed to skip seeding: pnpm db:reset --no-seed');
    console.log('   • Drop only: pnpm db:reset --drop-only');
    console.log('   • Force reset in production: pnpm db:reset --force');
}

reset().catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Reset failed:', errorMessage);
    process.exit(1);
});