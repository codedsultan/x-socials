/**
 * @file src/models/sql/otp.model.ts
 * @description SQL/Knex model for OTPs
 */

import type { Knex } from "knex";
import type { IOtpSQLRow, IOtpSQLInsert, IOtpSQLUpdate } from "../../interfaces/entities/auth/otp.sql";

export const OTP_TABLE = "otps";

export class OTPModel {
    constructor(private knex: Knex) { }

    get table() {
        return this.knex(OTP_TABLE);
    }

    async findById(id: number): Promise<IOtpSQLRow | undefined> {
        return this.table.where({ id }).first();
    }

    async findByOtp(otp: string): Promise<IOtpSQLRow | undefined> {
        return this.table.where({ otp, is_used: false }).first();
    }

    async findValidByEmail(email: string, type?: string): Promise<IOtpSQLRow | undefined> {
        let query = this.table
            .where({ email: email.toLowerCase(), is_used: false })
            .where("expires_at", ">", new Date());

        if (type) {
            query = query.where({ type });
        }

        return query.orderBy("created_at", "desc").first();
    }

    async findValidByPhone(phone: string, type?: string): Promise<IOtpSQLRow | undefined> {
        let query = this.table
            .where({ phone, is_used: false })
            .where("expires_at", ">", new Date());

        if (type) {
            query = query.where({ type });
        }

        return query.orderBy("created_at", "desc").first();
    }

    async findValidByUser(userId: number, type?: string): Promise<IOtpSQLRow[]> {
        let query = this.table
            .where({ user_id: userId, is_used: false })
            .where("expires_at", ">", new Date());

        if (type) {
            query = query.where({ type });
        }

        return query.orderBy("created_at", "desc");
    }

    async create(data: IOtpSQLInsert): Promise<IOtpSQLRow> {
        const [otp] = await this.table.insert(data).returning("*");
        return otp;
    }

    async update(id: number, data: IOtpSQLUpdate): Promise<IOtpSQLRow | undefined> {
        const [otp] = await this.table
            .where({ id })
            .update({ ...data, updated_at: new Date() })
            .returning("*");
        return otp;
    }

    async markAsUsed(id: number): Promise<IOtpSQLRow | undefined> {
        const [otp] = await this.table
            .where({ id })
            .update({
                is_used: true,
                updated_at: new Date()
            })
            .returning("*");
        return otp;
    }

    async verifyOTP(otp: string, type: string, identifier: string): Promise<IOtpSQLRow | undefined> {
        let query = this.table
            .where({ otp, type, is_used: false })
            .where("expires_at", ">", new Date());

        if (identifier.includes('@')) {
            query = query.where({ email: identifier.toLowerCase() });
        } else {
            query = query.where({ phone: identifier });
        }

        const [result] = await query
            .update({
                is_used: true,
                updated_at: new Date()
            })
            .returning("*");

        return result;
    }

    async delete(id: number): Promise<boolean> {
        const deleted = await this.table.where({ id }).delete();
        return deleted > 0;
    }

    async deleteExpired(): Promise<number> {
        const deleted = await this.table
            .where("expires_at", "<", new Date())
            .delete();
        return deleted;
    }

    async invalidateAllForUser(userId: number, type?: string): Promise<number> {
        let query = this.table
            .where({ user_id: userId, is_used: false });

        if (type) {
            query = query.where({ type });
        }

        const updated = await query.update({
            is_used: true,
            updated_at: new Date()
        });

        return updated;
    }

    async incrementAttempts(id: number): Promise<IOtpSQLRow | undefined> {
        const [otp] = await this.table
            .where({ id })
            .update({
                attempts: this.knex.raw("attempts + 1"),
                updated_at: new Date()
            })
            .returning("*");
        return otp;
    }

    async count(filters?: Partial<IOtpSQLRow>): Promise<number> {
        let query = this.table.count("id as count");
        if (filters) {
            query = query.where(filters);
        }
        const result = await query.first();
        return parseInt((result?.count as string) || "0", 10);
    }
}