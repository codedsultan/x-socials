/**
 * @file src/repositories/mongo/token.repository.ts
 * @description MongoDB implementation for Auth Tokens
 */

import DbManager from "../../config/db/DbManager";
import type { MongooseAdapter } from "../../config/db/adapters/MongooseAdapter";
import type { ITokenRepository } from "../../interfaces/repositories/token.repository";
import type { IAuthToken, TokenType } from "../../interfaces/entities/auth/token";
import { Types } from "mongoose";

// Define the raw MongoDB document shape
interface RawTokenDocument {
    _id: Types.ObjectId;
    token: string;
    userId: Types.ObjectId;
    type: TokenType;
    expiresAt: number;
    createdAt: Date;
    updatedAt: Date;
    __v?: number;
}

export class MongoTokenRepository implements ITokenRepository {
    private get adapter(): MongooseAdapter {
        const adapter = DbManager.getInstance().resolveForModel("TokenModel");
        if (!adapter) {
            throw new Error("TokenModel not bound to any connection. Call DbManager.bindModel() first.");
        }
        return adapter as MongooseAdapter;
    }

    private get connection() {
        const client = this.adapter.getClient();
        if (!client) {
            throw new Error("Mongoose connection not initialized.");
        }
        return client;
    }

    private get TokenModel() {
        return this.connection.model("Token");
    }

    async create(tokenData: Omit<IAuthToken, 'id' | 'createdAt' | 'updatedAt'>): Promise<IAuthToken> {
        // Transform to MongoDB document format
        const mongoTokenData = {
            token: tokenData.token,
            userId: new Types.ObjectId(tokenData.userId),
            type: 'access' as TokenType,
            expiresAt: tokenData.expiresAt
        };

        const token = await this.TokenModel.create(mongoTokenData);
        const tokenObject = token.toObject() as RawTokenDocument;

        return {
            id: tokenObject._id.toString(),
            token: tokenObject.token,
            userId: tokenObject.userId.toString(),
            type: tokenObject.type,
            expiresAt: tokenObject.expiresAt,
            createdAt: tokenObject.createdAt,
            updatedAt: tokenObject.updatedAt
        };
    }

    async findById(id: string | number): Promise<IAuthToken | null> {
        const token = await this.TokenModel.findById(id.toString()).lean() as RawTokenDocument | null;
        if (!token) return null;

        return {
            id: token._id.toString(),
            token: token.token,
            userId: token.userId.toString(),
            type: token.type,
            expiresAt: token.expiresAt,
            createdAt: token.createdAt,
            updatedAt: token.updatedAt
        };
    }

    async findByToken(token: string): Promise<IAuthToken | null> {
        const result = await this.TokenModel.findOne({ token }).lean() as RawTokenDocument | null;
        if (!result) return null;

        return {
            id: result._id.toString(),
            token: result.token,
            userId: result.userId.toString(),
            type: result.type,
            expiresAt: result.expiresAt,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt
        };
    }

    async findByUserId(userId: string | number, options?: { type?: TokenType; isValid?: boolean }): Promise<IAuthToken[]> {
        const query: any = { userId: userId.toString() };

        if (options?.type) {
            query.type = options.type;
        }

        if (options?.isValid === true) {
            query.expiresAt = { $gt: Date.now() };
        }

        const tokens = await this.TokenModel.find(query).sort({ createdAt: -1 }).lean() as RawTokenDocument[];
        return tokens.map(token => ({
            id: token._id.toString(),
            token: token.token,
            userId: token.userId.toString(),
            type: token.type,
            expiresAt: token.expiresAt,
            createdAt: token.createdAt,
            updatedAt: token.updatedAt
        }));
    }

    async findAllValidForUser(userId: string | number): Promise<IAuthToken[]> {
        return this.findByUserId(userId, { isValid: true });
    }

    async update(id: string | number, updates: Partial<Omit<IAuthToken, 'id' | 'createdAt'>>): Promise<IAuthToken | null> {
        // Transform updates to MongoDB format
        const mongoUpdates: any = {};

        if (updates.token) mongoUpdates.token = updates.token;
        if (updates.userId) mongoUpdates.userId = new Types.ObjectId(updates.userId);
        if (updates.type) mongoUpdates.type = updates.type;
        if (updates.expiresAt !== undefined) mongoUpdates.expiresAt = updates.expiresAt;

        const token = await this.TokenModel.findByIdAndUpdate(
            id.toString(),
            { $set: mongoUpdates },
            { new: true, lean: true }
        ) as RawTokenDocument | null;

        if (!token) return null;

        return {
            id: token._id.toString(),
            token: token.token,
            userId: token.userId.toString(),
            type: token.type,
            expiresAt: token.expiresAt,
            createdAt: token.createdAt,
            updatedAt: token.updatedAt
        };
    }

    async delete(id: string | number): Promise<boolean> {
        const result = await this.TokenModel.findByIdAndDelete(id.toString());
        return !!result;
    }

    async invalidateToken(id: string | number): Promise<boolean> {
        const result = await this.TokenModel.findByIdAndUpdate(
            id.toString(),
            { $set: { expiresAt: Date.now() - 1000 } },
            { new: true }
        );
        return !!result;
    }

    async invalidateAllForUser(userId: string | number, excludeTokenId?: string | number): Promise<number> {
        const query: any = { userId: userId.toString() };
        if (excludeTokenId) {
            query._id = { $ne: excludeTokenId.toString() };
        }

        const result = await this.TokenModel.updateMany(
            query,
            { $set: { expiresAt: Date.now() - 1000 } }
        );
        return result.modifiedCount;
    }

    async cleanupExpiredTokens(): Promise<number> {
        const result = await this.TokenModel.deleteMany({
            expiresAt: { $lt: Date.now() }
        });
        return result.deletedCount;
    }

    async refreshToken(oldTokenId: string | number, newTokenData: Omit<IAuthToken, 'id' | 'createdAt' | 'updatedAt'>): Promise<IAuthToken> {
        // Invalidate old token
        await this.invalidateToken(oldTokenId);
        // Create new token
        return this.create(newTokenData);
    }

    async count(filters?: Partial<IAuthToken>): Promise<number> {
        const mongoFilters: any = {};
        if (filters) {
            for (const [key, value] of Object.entries(filters)) {
                if (value !== undefined && value !== null) {
                    if (key === 'userId') {
                        mongoFilters.userId = value.toString();
                    } else if (key === 'expiresAt') {
                        mongoFilters.expiresAt = value;
                    } else {
                        mongoFilters[key] = value;
                    }
                }
            }
        }
        return this.TokenModel.countDocuments(mongoFilters);
    }

    async exists(token: string): Promise<boolean> {
        const count = await this.TokenModel.countDocuments({ token });
        return count > 0;
    }

    async isTokenValid(token: string): Promise<boolean> {
        const result = await this.TokenModel.findOne({
            token,
            expiresAt: { $gt: Date.now() }
        }).lean() as RawTokenDocument | null;
        return !!result;
    }
}