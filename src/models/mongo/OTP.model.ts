/**
 * @file src/models/mongo/OTP.model.ts
 * @description Mongoose model for OTPs
 */

import mongoose, { Schema } from 'mongoose';
import type { IOtpMongoDocument } from '../../interfaces/entities/auth/otp.mongo';
import type { OTPType } from '../../interfaces/entities/auth/otp';

const OTPSchema = new Schema<IOtpMongoDocument>(
    {
        otp: { type: String, required: true },
        type: {
            type: String,
            enum: ['email_verification', 'phone_verification', 'password_reset', 'login'],
            required: true
        },
        expiresAt: { type: Date, required: true },
        email: { type: String, lowercase: true, trim: true, sparse: true },
        phone: { type: String, trim: true, sparse: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', sparse: true },
        isUsed: { type: Boolean, default: false },
        attempts: { type: Number, default: 0 }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Indexes
OTPSchema.index({ otp: 1 });
OTPSchema.index({ email: 1, type: 1, isUsed: 1 });
OTPSchema.index({ phone: 1, type: 1, isUsed: 1 });
OTPSchema.index({ userId: 1, type: 1 });
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

// Virtual for id
OTPSchema.virtual('id').get(function (this: IOtpMongoDocument) {
    return this._id.toHexString();
});

// Instance methods
OTPSchema.methods.isExpired = function (this: IOtpMongoDocument): boolean {
    return new Date() > this.expiresAt;
};

OTPSchema.methods.canResend = function (this: IOtpMongoDocument, resendDelayMinutes: number = 5): boolean {
    const now = new Date();
    const createdAt = new Date(this.createdAt);
    const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / 1000 / 60;
    return minutesSinceCreation >= resendDelayMinutes;
};

OTPSchema.methods.incrementAttempts = async function (this: IOtpMongoDocument): Promise<void> {
    this.attempts = (this.attempts || 0) + 1;
    await this.save();
};

export const OTPModel = mongoose.model<IOtpMongoDocument>('OTP', OTPSchema);