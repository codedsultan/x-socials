/**
 * @file src/models/register-models.ts
 * @description Register all models with their respective database connections
 */

import DbManager from "../config/db/DbManager";
import mongoose from 'mongoose';
import type { MongooseAdapter } from "../config/db/adapters/MongooseAdapter";
import type { KnexAdapter } from "../config/db/adapters/KnexAdapter";

// Import MongoDB schemas
import { PostSchema } from "./mongo/schemas/Post.schema";
import { UserSchema } from "./mongo/schemas/User.schema";
import { TokenSchema } from "./mongo/schemas/Token.schema";
import { OTPSchema } from "./mongo/schemas/OTP.schema";

// Import SQL models (knex query builders)
import { UserSQLModel } from "./sql/user.model";
import { TokenSQLModel } from "./sql/token.model";
import { OTPModel } from "./sql/otp.model";
import { PostSQLModel } from "./sql/post.model";

// Interface for SQL models container
interface SQLModelsContainer {
    user: UserSQLModel;
    token: TokenSQLModel;
    otp: OTPModel;
    post: PostSQLModel;
}

class ModelRegistry {
    private static sqlModels: SQLModelsContainer | null = null;
    private static mongoModels: Map<string, mongoose.Model<any>> = new Map();

    static async registerAll(): Promise<void> {
        const dbManager = DbManager.getInstance();

        // Register MongoDB models
        await this.registerMongoModels(dbManager);

        // Register PostgreSQL models
        await this.registerPostgresModels(dbManager);

        console.log('🎉 All models registered successfully');
    }

    private static async registerMongoModels(dbManager: DbManager): Promise<void> {
        const mongoAdapter = dbManager.resolveForModel("PostModel") as MongooseAdapter;

        if (!mongoAdapter) {
            console.warn('⚠️ MongoDB adapter not found, skipping MongoDB model registration');
            return;
        }

        const mongoConnection = mongoAdapter.getClient();

        if (!mongoConnection) {
            console.warn('⚠️ MongoDB client not available, skipping MongoDB model registration');
            return;
        }

        // Register models
        this.mongoModels.set('Post', mongoConnection.model('Post', PostSchema));
        // this.mongoModels.set('Comment', mongoConnection.model('Comment', CommentSchema));
        // this.mongoModels.set('Like', mongoConnection.model('Like', LikeSchema));
        // this.mongoModels.set('Feed', mongoConnection.model('Feed', FeedSchema));

        console.log('✅ MongoDB models registered');
    }

    private static async registerPostgresModels(dbManager: DbManager): Promise<void> {
        const pgAdapter = dbManager.resolveForModel("UserModel") as KnexAdapter;

        if (!pgAdapter) {
            console.warn('⚠️ PostgreSQL adapter not found, skipping SQL model initialization');
            return;
        }

        const knex = pgAdapter.getClient();

        if (!knex) {
            console.warn('⚠️ PostgreSQL Knex client not available, skipping SQL model initialization');
            return;
        }

        // Create SQL model instances
        this.sqlModels = {
            user: new UserSQLModel(knex),
            token: new TokenSQLModel(knex),
            otp: new OTPModel(knex),
            post: new PostSQLModel(knex),
        };

        console.log('✅ PostgreSQL models initialized');
    }

    static getSQLModels(): SQLModelsContainer {
        if (!this.sqlModels) {
            throw new Error(
                'SQL models not initialized. ' +
                'Make sure registerAllModels() was called before accessing models.'
            );
        }
        return this.sqlModels;
    }

    static getMongoModel<T = any>(modelName: string): mongoose.Model<T> {
        const model = this.mongoModels.get(modelName);
        if (!model) {
            throw new Error(
                `MongoDB model "${modelName}" not found. ` +
                `Make sure it was registered in registerMongoModels().`
            );
        }
        return model as mongoose.Model<T>;
    }

    static isMongoDBAvailable(): boolean {
        return this.mongoModels.size > 0;
    }

    static isPostgresAvailable(): boolean {
        return this.sqlModels !== null;
    }
}

// Export convenience functions
export const registerAllModels = () => ModelRegistry.registerAll();
export const getSQLModels = () => ModelRegistry.getSQLModels();
export const getMongoModel = <T = any>(name: string) => ModelRegistry.getMongoModel<T>(name);
export const isMongoDBAvailable = () => ModelRegistry.isMongoDBAvailable();
export const isPostgresAvailable = () => ModelRegistry.isPostgresAvailable();