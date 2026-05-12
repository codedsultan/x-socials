/**
 * @file src/models/mongo/schemas/Token.schema.ts
 * @description Mongoose schema for Auth Tokens (without model registration)
 */

import { Schema } from 'mongoose';
import type { IAuthTokenMongoDocument } from '../../../interfaces/entities/auth/token';

export const TokenSchema = new Schema<IAuthTokenMongoDocument>(
    {
        token: { type: String, required: true, unique: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        type: {
            type: String,
            enum: ['access', 'refresh', 'reset_password', 'email_verification'],
            required: true
        },
        expiresAt: { type: Number, required: true }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Indexes
TokenSchema.index({ token: 1 });
TokenSchema.index({ userId: 1, type: 1 });
TokenSchema.index({ expiresAt: 1 });

// Virtual for id
TokenSchema.virtual('id').get(function (this: IAuthTokenMongoDocument) {
    return this._id.toHexString();
});

// Instance methods
TokenSchema.methods.isExpired = function (this: IAuthTokenMongoDocument): boolean {
    return Date.now() > this.expiresAt;
};

TokenSchema.methods.refresh = async function (this: IAuthTokenMongoDocument): Promise<IAuthTokenMongoDocument> {
    this.expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
    this.updatedAt = new Date();
    await this.save();
    return this;
};