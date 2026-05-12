/**
 * @file src/interfaces/entities/auth/otp.ts
 * @description Database-agnostic OTP entity
 */

export type OTPType = 'email_verification' | 'phone_verification' | 'password_reset' | 'login';

export interface IOtp {
    id: string;
    otp: string;
    type: OTPType;
    expiresAt: Date;
    email?: string;
    phone?: string;
    userId?: string;
    isUsed: boolean;
    attempts?: number;
    createdAt: Date;
    updatedAt: Date;
}