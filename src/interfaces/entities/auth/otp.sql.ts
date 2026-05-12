/**
 * @file src/interfaces/entities/auth/otp.sql.ts
 * @description SQL-specific OTP interfaces
 */

import type { IOtp, OTPType } from './otp';

export interface IOtpSQLRow {
    id: number;
    otp: string;
    type: OTPType;
    expires_at: Date;
    email?: string | null;
    phone?: string | null;
    user_id?: number | null;
    is_used: boolean;
    attempts: number;
    created_at: Date;
    updated_at: Date;
}

export type IOtpSQLInsert = Omit<IOtpSQLRow, 'id' | 'created_at' | 'updated_at'>;
export type IOtpSQLUpdate = Partial<IOtpSQLInsert>;