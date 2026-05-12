/**
 * @file src/interfaces/repositories/otp.repository.ts
 * @description Database-agnostic OTP repository interface
 */

import type { IOtp, OTPType } from "../entities/auth/otp";

export interface IOtpRepository {
    // Core CRUD
    create(otpData: Omit<IOtp, 'id' | 'createdAt' | 'updatedAt'>): Promise<IOtp>;
    findById(id: string | number): Promise<IOtp | null>;
    update(id: string | number, updates: Partial<Omit<IOtp, 'id' | 'createdAt'>>): Promise<IOtp | null>;
    delete(id: string | number): Promise<boolean>;

    // Query methods
    findByToken(otp: string): Promise<IOtp | null>;
    findValidByUser(userId: string | number, type?: OTPType): Promise<IOtp[]>;
    findValidByEmail(email: string, type?: OTPType): Promise<IOtp | null>;
    findValidByPhone(phone: string, type?: OTPType): Promise<IOtp | null>;

    // OTP specific operations
    verifyOTP(otp: string, type: OTPType, identifier: string): Promise<IOtp | null>;
    markAsUsed(id: string | number): Promise<IOtp | null>;
    invalidateAllForUser(userId: string | number, type?: OTPType): Promise<number>;
    cleanupExpiredOTPs(): Promise<number>;

    // Utility
    count(filters?: Partial<IOtp>): Promise<number>;
    exists(id: string | number): Promise<boolean>;
}