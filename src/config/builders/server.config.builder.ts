import { IEnvConfig, Environment } from '../../interfaces/core/config';
import { EnvLoader } from '../env.loader';
import winston from 'winston';

export class ServerConfigBuilder {
    constructor(private logger?: winston.Logger) { }

    public build(): IEnvConfig {
        const nodeEnv = (EnvLoader.getString('NODE_ENV') as Environment) || 'development';
        const port = EnvLoader.getNumber('PORT', 4000);

        this.validatePort(port);
        this.validateNodeEnv(nodeEnv);

        const config: IEnvConfig = {
            PORT: port!,
            NODE_ENV: nodeEnv,
            SERVER_MAINTENANCE: EnvLoader.getBoolean('SERVER_MAINTENANCE', false) || false,
            API_BASE_URL: EnvLoader.getString('API_BASE_URL', 'http://localhost:5000') || 'http://localhost:5000',
            ENABLE_SWAGGER: this.calculateSwaggerEnabled(nodeEnv),
            CORS_ENABLED: EnvLoader.getBoolean('CORS_ENABLED', true) || true,

            // Database configs (optional)
            MONGO_URI: EnvLoader.getString('MONGO_URI'),
            MONGO_DB_NAME: EnvLoader.getString('MONGO_DB_NAME'),
            DB_NAME: EnvLoader.getString('DB_NAME'),
            MONGO_SOCKET_TIMEOUT_MS: EnvLoader.getString('MONGO_SOCKET_TIMEOUT_MS'),
            MONGO_SERVER_SELECTION_TIMEOUT_MS: EnvLoader.getString('MONGO_SERVER_SELECTION_TIMEOUT_MS'),

            PG_HOST: EnvLoader.getString('PG_HOST'),
            PG_PORT: EnvLoader.getString('PG_PORT'),
            PG_DATABASE: EnvLoader.getString('PG_DATABASE'),
            PG_USER: EnvLoader.getString('PG_USER'),
            PG_PASSWORD: EnvLoader.getString('PG_PASSWORD'),
            PG_SSL: EnvLoader.getString('PG_SSL'),
            PG_CLIENT: EnvLoader.getString('PG_CLIENT'),
            PG_POOL_MIN: EnvLoader.getString('PG_POOL_MIN'),
            PG_POOL_MAX: EnvLoader.getString('PG_POOL_MAX'),

            MYSQL_HOST: EnvLoader.getString('MYSQL_HOST'),
            MYSQL_PORT: EnvLoader.getString('MYSQL_PORT'),
            MYSQL_DATABASE: EnvLoader.getString('MYSQL_DATABASE'),
            MYSQL_USER: EnvLoader.getString('MYSQL_USER'),
            MYSQL_PASSWORD: EnvLoader.getString('MYSQL_PASSWORD'),
            MYSQL_CLIENT: EnvLoader.getString('MYSQL_CLIENT'),

            SQLITE_FILENAME: EnvLoader.getString('SQLITE_FILENAME'),
            SQLITE_CLIENT: EnvLoader.getString('SQLITE_CLIENT'),

            DEFAULT_DB: EnvLoader.getString('DEFAULT_DB'),

            API_PREFIX: EnvLoader.getString('API_PREFIX'),
            LOG_DAYS: EnvLoader.getNumber('LOG_DAYS'),
            JWT_SECRET: EnvLoader.getString('JWT_SECRET'),
            JWT_EXPIRES_IN: EnvLoader.getString('JWT_EXPIRES_IN'),
            SENDGRID_API_KEY: EnvLoader.getString('SENDGRID_API_KEY'),
            SMTP_FROM: EnvLoader.getString('SMTP_FROM'),
            CLOUDINARY_CLOUD_NAME: EnvLoader.getString('CLOUDINARY_CLOUD_NAME'),
            CLOUDINARY_API_KEY: EnvLoader.getString('CLOUDINARY_API_KEY'),
            CLOUDINARY_API_SECRET: EnvLoader.getString('CLOUDINARY_API_SECRET'),
        };

        this.logWarnings(config);

        return config;
    }

    private validatePort(port?: number): void {
        if (port !== undefined && (port < 0 || port > 65535)) {
            throw new Error(`Invalid PORT number: ${port}. Must be between 0 and 65535.`);
        }
    }

    private validateNodeEnv(env: Environment): void {
        const validEnvs: Environment[] = ['development', 'staging', 'production', 'test'];
        if (!validEnvs.includes(env)) {
            throw new Error(`Invalid NODE_ENV: ${env}. Must be one of: ${validEnvs.join(', ')}`);
        }
    }

    private calculateSwaggerEnabled(nodeEnv: Environment): boolean {
        const explicitValue = EnvLoader.getBoolean('ENABLE_SWAGGER');
        if (explicitValue !== undefined) return explicitValue;

        if (nodeEnv === 'production') return false;
        if (nodeEnv === 'staging') return true;
        return true;
    }

    private logWarnings(config: IEnvConfig): void {
        if (!this.logger) return;

        if (config.NODE_ENV === 'staging') {
            this.logger.warn('Running in STAGING mode');
        }

        if (config.PORT === 0) {
            this.logger.info('Using dynamic port (OS will assign available port)');
        }

        if (config.NODE_ENV === 'production' && config.ENABLE_SWAGGER) {
            this.logger.warn('Swagger is enabled in production - recommended to disable');
        }

        this.logger.info(`Server config loaded (${config.NODE_ENV} mode)`);
    }
}