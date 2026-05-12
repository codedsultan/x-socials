
import { IDatabaseConfig, IMongoDbConfig, IPostgresConfig, IMysqlConfig, ISqliteConfig } from '../../interfaces/core/config';
import { EnvLoader } from '../env.loader';
import winston from 'winston';

export class DatabaseConfigBuilder {
    constructor(private logger?: winston.Logger) { }

    public build(): IDatabaseConfig {
        // Load MongoDB config
        const mongoConfig = this.loadMongoConfig();

        // Load PostgreSQL config
        const postgresConfig = this.loadPostgresConfig();

        // Load MySQL config
        const mysqlConfig = this.loadMysqlConfig();

        // Load SQLite config
        const sqliteConfig = this.loadSqliteConfig();

        const configuredDbs = this.getConfiguredDatabases(mongoConfig, postgresConfig, mysqlConfig, sqliteConfig);
        const defaultDb = this.calculateDefaultDb(configuredDbs);

        this.logDatabaseStatus(configuredDbs);

        return {
            mongodb: mongoConfig || undefined,
            postgres: postgresConfig || undefined,
            mysql: mysqlConfig || undefined,
            sqlite: sqliteConfig || undefined,
            defaultDb,
        };
    }

    private loadMongoConfig(): IMongoDbConfig | null {
        const uri = EnvLoader.getString('MONGO_URI');

        if (!uri) {
            return null;
        }

        return {
            uri,
            dbName: EnvLoader.getString('MONGO_DB_NAME', 'x_socials') || 'x_socials',
            socketTimeoutMS: EnvLoader.getNumber('MONGO_SOCKET_TIMEOUT_MS', 30000) || 30000,
            serverSelectionTimeoutMS: EnvLoader.getNumber('MONGO_SERVER_SELECTION_TIMEOUT_MS', 5000) || 5000,
        };
    }

    private loadPostgresConfig(): IPostgresConfig | null {
        const host = EnvLoader.getString('PG_HOST');
        const database = EnvLoader.getString('PG_DATABASE');

        if (!host || !database) {
            return null;
        }

        return {
            host,
            port: EnvLoader.getNumber('PG_PORT', 5432) || 5432,
            database,
            user: EnvLoader.getString('PG_USER'),
            password: EnvLoader.getString('PG_PASSWORD'),
            ssl: EnvLoader.getBoolean('PG_SSL', false) || false,
            client: EnvLoader.getString('PG_CLIENT', 'pg') || 'pg',
            poolMin: EnvLoader.getNumber('PG_POOL_MIN', 2) || 2,
            poolMax: EnvLoader.getNumber('PG_POOL_MAX', 10) || 10,
        };
    }

    private loadMysqlConfig(): IMysqlConfig | null {
        const host = EnvLoader.getString('MYSQL_HOST');
        const database = EnvLoader.getString('MYSQL_DATABASE');

        if (!host || !database) {
            return null;
        }

        return {
            host,
            port: EnvLoader.getNumber('MYSQL_PORT', 3306) || 3306,
            database,
            user: EnvLoader.getString('MYSQL_USER'),
            password: EnvLoader.getString('MYSQL_PASSWORD'),
            client: EnvLoader.getString('MYSQL_CLIENT', 'mysql2') || 'mysql2',
            poolMin: EnvLoader.getNumber('MYSQL_POOL_MIN', 2) || 2,
            poolMax: EnvLoader.getNumber('MYSQL_POOL_MAX', 10) || 10,
        };
    }

    private loadSqliteConfig(): ISqliteConfig | null {
        const filename = EnvLoader.getString('SQLITE_FILENAME');

        if (!filename) {
            return null;
        }

        return {
            filename,
            client: EnvLoader.getString('SQLITE_CLIENT', 'sqlite3') || 'sqlite3',
            poolMin: EnvLoader.getNumber('SQLITE_POOL_MIN', 1) || 1,
            poolMax: EnvLoader.getNumber('SQLITE_POOL_MAX', 1) || 1,
        };
    }

    private getConfiguredDatabases(
        mongo: IMongoDbConfig | null,
        postgres: IPostgresConfig | null,
        mysql: IMysqlConfig | null,
        sqlite: ISqliteConfig | null
    ): string[] {
        const configured: string[] = [];
        if (mongo) configured.push('mongodb');
        if (postgres) configured.push('postgres');
        if (mysql) configured.push('mysql');
        if (sqlite) configured.push('sqlite');
        return configured;
    }

    private calculateDefaultDb(configuredDbs: string[]): string {
        const defaultDbFromEnv = EnvLoader.getString('DEFAULT_DB', 'mongodb') || 'mongodb';

        if (configuredDbs.length === 0) {
            this.logger?.warn('No databases configured');
            return defaultDbFromEnv;
        }

        if (!configuredDbs.includes(defaultDbFromEnv)) {
            const fallback = configuredDbs[0];
            this.logger?.warn(`Default DB ${defaultDbFromEnv} is not configured. Using ${fallback} instead.`);
            return fallback;
        }

        return defaultDbFromEnv;
    }

    private logDatabaseStatus(configuredDbs: string[]): void {
        if (!this.logger) return;

        const dbNames = configuredDbs.map(db => {
            switch (db) {
                case 'mongodb': return 'MongoDB';
                case 'postgres': return 'PostgreSQL';
                case 'mysql': return 'MySQL';
                case 'sqlite': return 'SQLite';
                default: return db;
            }
        });

        if (dbNames.length > 0) {
            this.logger.info(`Configured databases: ${dbNames.join(', ')}`);
        } else {
            this.logger.warn('No databases configured');
        }
    }
}