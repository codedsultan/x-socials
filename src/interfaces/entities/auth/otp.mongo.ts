/**
 * @file src/interfaces/entities/auth/otp.mongo.ts
 * @description MongoDB-specific OTP interfaces
 */

import type { Document, Types } from "mongoose";
import type { IOtp, OTPType } from './otp';

export interface IOtpMongoDocument extends Omit<IOtp, 'id'>, Document {
    _id: Types.ObjectId;
    id: string;
    type: OTPType;
    expiresAt: Date;
    isUsed: boolean;
    attempts: number;
    createdAt: Date;
    updatedAt: Date;

    // Instance methods
    isExpired(): boolean;
    canResend(resendDelayMinutes?: number): boolean;
    incrementAttempts(): Promise<void>;
}