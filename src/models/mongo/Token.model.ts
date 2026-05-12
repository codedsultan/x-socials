/**
 * @file src/models/mongo/Token.model.ts
 * @description Mongoose model for Auth Tokens
 */

import mongoose, { Schema } from 'mongoose';
import type { IAuthTokenMongoDocument } from '../../interfaces/entities/auth/token';

const TokenSchema = new Schema<IAuthTokenMongoDocument>(
    {
        token: { type: String, required: true, unique: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        type: {
            type: String,
            enum: ['access', 'refresh', 'reset_password', 'email_verification'],
            required: true
        },
        expiresAt: { type: Number, required: true } // Unix timestamp
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
TokenSchema.index({ expiresAt: 1 }); // For cleanup queries

// Virtual for id
TokenSchema.virtual('id').get(function (this: IAuthTokenMongoDocument) {
    return this._id.toHexString();
});

// Instance methods
TokenSchema.methods.isExpired = function (this: IAuthTokenMongoDocument): boolean {
    return Date.now() > this.expiresAt;
};

TokenSchema.methods.refresh = async function (this: IAuthTokenMongoDocument): Promise<IAuthTokenMongoDocument> {
    // Generate new expiration (e.g., 7 days from now)
    this.expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
    this.updatedAt = new Date();
    await this.save();
    return this;
};

export const TokenModel = mongoose.model<IAuthTokenMongoDocument>('Token', TokenSchema);