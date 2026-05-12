/**
 * @file src/factories/RepositoryFactory.ts
 * @description Factory for creating repository instances with proper dependencies
 */

import DbManager from "../config/db/DbManager";
import Logger from "../logger";
import { getSQLModels, getMongoModel } from "../models/register-models";

// User Repositories
import { MongoUserRepository } from "../repositories/mongo/user.repository";
import { SQLUserRepository } from "../repositories/sql/user.repository";
import type { IUserRepository } from "../interfaces/repositories/user.repository";

// Post Repositories
import { MongoPostRepository } from "../repositories/mongo/post.repository";
import { SQLPostRepository } from "../repositories/sql/post.repository";
import type { IPostRepository } from "../interfaces/repositories/post.repository";

// Auth Token Repositories
import { MongoTokenRepository } from "../repositories/mongo/token.repository";
import { SQLTokenRepository } from "../repositories/sql/token.repository";
import type { ITokenRepository } from "../interfaces/repositories/token.repository";

// OTP Repositories
import { MongoOtpRepository } from "../repositories/mongo/otp.repository";
import { SQLOtpRepository } from "../repositories/sql/otp.repository";
import type { IOtpRepository } from "../interfaces/repositories/otp.repository";

export type RepositoryType = 'user' | 'post' | 'token' | 'otp';
export type DatabaseAdapterType = 'mongodb' | 'postgresql' | 'mysql' | 'sqlite';

export interface IRepositoryFactory {
    getUserRepository(): IUserRepository;
    getPostRepository(): IPostRepository;
    getTokenRepository(): ITokenRepository;
    getOtpRepository(): IOtpRepository;
    getRepository<T>(type: RepositoryType): T;
    getCurrentDatabaseType(): DatabaseAdapterType;
}

export class RepositoryFactory implements IRepositoryFactory {
    private static instance: RepositoryFactory;
    private repositories: Map<string, any> = new Map();
    private dbType: DatabaseAdapterType | null = null;
    private sqlModels: any = null;
    private mongoModels: Map<string, any> = new Map();

    private constructor() { }

    static getInstance(): RepositoryFactory {
        if (!RepositoryFactory.instance) {
            RepositoryFactory.instance = new RepositoryFactory();
        }
        return RepositoryFactory.instance;
    }

    /**
     * Initialize the factory with model instances
     */
    public async initialize(): Promise<void> {
        try {
            // Get SQL models if available
            try {
                this.sqlModels = getSQLModels();
                Logger.getInstance().info("RepositoryFactory :: SQL models loaded");
            } catch (error) {
                Logger.getInstance().warn("RepositoryFactory :: SQL models not available");
            }

            // Get MongoDB models if available
            try {
                const mongoModelNames = ['Post', 'User', 'Token', 'OTP'];
                for (const modelName of mongoModelNames) {
                    try {
                        const model = getMongoModel(modelName);
                        this.mongoModels.set(modelName, model);
                        Logger.getInstance().debug(`RepositoryFactory :: MongoDB model ${modelName} loaded`);
                    } catch (error) {
                        // Model not registered in MongoDB, skip
                    }
                }
            } catch (error) {
                Logger.getInstance().warn("RepositoryFactory :: MongoDB models not available");
            }

            Logger.getInstance().info("RepositoryFactory :: Initialized successfully");
        } catch (error) {
            Logger.getInstance().error(`RepositoryFactory :: Initialization error: ${error}`);
            throw error;
        }
    }

    /**
     * Detect current database type from DbManager's default connection
     */
    private detectDatabaseType(): DatabaseAdapterType {
        if (this.dbType) return this.dbType;

        try {
            const dbManager = DbManager.getInstance();
            const defaultAdapter = dbManager.registry.getDefault();
            const driver = defaultAdapter.driver;

            // Map driver names to database types
            if (driver === 'mongoose') {
                this.dbType = 'mongodb';
            } else if (driver === 'pg' || driver === 'pg-native') {
                this.dbType = 'postgresql';
            } else if (driver === 'mysql' || driver === 'mysql2') {
                this.dbType = 'mysql';
            } else if (driver === 'sqlite3' || driver === 'better-sqlite3') {
                this.dbType = 'sqlite';
            } else {
                throw new Error(`Unknown driver type: ${driver}`);
            }

            Logger.getInstance().info(
                `RepositoryFactory :: Detected database type: ${this.dbType} (driver: ${driver})`
            );
        } catch (error) {
            Logger.getInstance().warn(
                `RepositoryFactory :: Could not detect database type from DbManager, defaulting to postgresql. Error: ${error}`
            );
            this.dbType = 'postgresql';
        }

        return this.dbType;
    }

    /**
     * Manually set database type (useful for testing)
     */
    public setDatabaseType(type: DatabaseAdapterType): void {
        this.dbType = type;
        this.clearCache();
        Logger.getInstance().info(`RepositoryFactory :: Database type manually set to: ${type}`);
    }

    /**
     * Get current database type
     */
    public getCurrentDatabaseType(): DatabaseAdapterType {
        return this.detectDatabaseType();
    }

    /**
     * Clear cached repositories
     */
    public clearCache(): void {
        this.repositories.clear();
        Logger.getInstance().debug("RepositoryFactory :: Repository cache cleared");
    }

    getUserRepository(): IUserRepository {
        const dbType = this.detectDatabaseType();
        const cacheKey = `${dbType}_user`;

        if (!this.repositories.has(cacheKey)) {
            let repo: IUserRepository;

            if (dbType === 'mongodb') {
                const mongoUserModel = this.mongoModels.get('User');
                if (!mongoUserModel) {
                    throw new Error('MongoDB User model not available');
                }
                repo = new MongoUserRepository(mongoUserModel);
            } else if (['postgresql', 'mysql', 'sqlite'].includes(dbType)) {
                if (!this.sqlModels) {
                    throw new Error('SQL models not available');
                }
                repo = new SQLUserRepository(this.sqlModels.user);
            } else {
                throw new Error(`Unsupported database type for UserRepository: ${dbType}`);
            }

            this.repositories.set(cacheKey, repo);
            Logger.getInstance().debug(`RepositoryFactory :: Created ${dbType} UserRepository`);
        }

        return this.repositories.get(cacheKey);
    }

    getPostRepository(): IPostRepository {
        const dbType = this.detectDatabaseType();
        const cacheKey = `${dbType}_post`;

        if (!this.repositories.has(cacheKey)) {
            let repo: IPostRepository;

            if (dbType === 'mongodb') {
                const mongoPostModel = this.mongoModels.get('Post');
                if (!mongoPostModel) {
                    throw new Error('MongoDB Post model not available');
                }
                repo = new MongoPostRepository(mongoPostModel);
            } else if (['postgresql', 'mysql', 'sqlite'].includes(dbType)) {
                if (!this.sqlModels) {
                    throw new Error('SQL models not available');
                }
                repo = new SQLPostRepository(this.sqlModels.post);
            } else {
                throw new Error(`Unsupported database type for PostRepository: ${dbType}`);
            }

            this.repositories.set(cacheKey, repo);
            Logger.getInstance().debug(`RepositoryFactory :: Created ${dbType} PostRepository`);
        }

        return this.repositories.get(cacheKey);
    }

    getTokenRepository(): ITokenRepository {
        const dbType = this.detectDatabaseType();
        const cacheKey = `${dbType}_token`;

        if (!this.repositories.has(cacheKey)) {
            let repo: ITokenRepository;

            if (dbType === 'mongodb') {
                const mongoTokenModel = this.mongoModels.get('Token');
                if (!mongoTokenModel) {
                    throw new Error('MongoDB Token model not available');
                }
                repo = new MongoTokenRepository(mongoTokenModel);
            } else if (['postgresql', 'mysql', 'sqlite'].includes(dbType)) {
                if (!this.sqlModels) {
                    throw new Error('SQL models not available');
                }
                repo = new SQLTokenRepository(this.sqlModels.token);
            } else {
                throw new Error(`Unsupported database type for TokenRepository: ${dbType}`);
            }

            this.repositories.set(cacheKey, repo);
            Logger.getInstance().debug(`RepositoryFactory :: Created ${dbType} TokenRepository`);
        }

        return this.repositories.get(cacheKey);
    }

    getOtpRepository(): IOtpRepository {
        const dbType = this.detectDatabaseType();
        const cacheKey = `${dbType}_otp`;

        if (!this.repositories.has(cacheKey)) {
            let repo: IOtpRepository;

            if (dbType === 'mongodb') {
                const mongoOtpModel = this.mongoModels.get('OTP');
                if (!mongoOtpModel) {
                    throw new Error('MongoDB OTP model not available');
                }
                repo = new MongoOtpRepository(mongoOtpModel);
            } else if (['postgresql', 'mysql', 'sqlite'].includes(dbType)) {
                if (!this.sqlModels) {
                    throw new Error('SQL models not available');
                }
                repo = new SQLOtpRepository(this.sqlModels.otp);
            } else {
                throw new Error(`Unsupported database type for OtpRepository: ${dbType}`);
            }

            this.repositories.set(cacheKey, repo);
            Logger.getInstance().debug(`RepositoryFactory :: Created ${dbType} OtpRepository`);
        }

        return this.repositories.get(cacheKey);
    }

    getRepository<T>(type: RepositoryType): T {
        switch (type) {
            case 'user':
                return this.getUserRepository() as T;
            case 'post':
                return this.getPostRepository() as T;
            case 'token':
                return this.getTokenRepository() as T;
            case 'otp':
                return this.getOtpRepository() as T;
            default:
                throw new Error(`Unknown repository type: ${type}`);
        }
    }
}

// Convenience function for quick access
export const getRepositoryFactory = (): IRepositoryFactory => {
    return RepositoryFactory.getInstance();
};