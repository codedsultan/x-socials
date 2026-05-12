/**
 * @file src/repositories/sql/otp.repository.ts
 * @description SQL (PostgreSQL) implementation for OTPs
 */

import DbManager from "../../config/db/DbManager";
import { KnexAdapter } from "../../config/db/adapters/KnexAdapter";
import type { IOtpRepository } from "../../interfaces/repositories/otp.repository";
import type { IOtp, OTPType } from "../../interfaces/entities/auth/otp";
import type { IOtpSQLRow, IOtpSQLInsert } from "../../interfaces/entities/auth/otp.sql";
import type { Knex } from "knex";

export class SQLOtpRepository implements IOtpRepository {
    private get adapter(): KnexAdapter {
        const adapter = DbManager.getInstance().resolveForModel("OTPModel");
        if (!adapter) {
            throw new Error("OTPModel not bound to any connection. Call DbManager.bindModel() first.");
        }
        if (!(adapter instanceof KnexAdapter)) {
            throw new Error("OTPModel is not bound to a SQL/Knex connection");
        }
        return adapter as KnexAdapter;
    }

    private get knex(): Knex {
        const client = this.adapter.getClient();
        if (!client) {
            throw new Error("Knex client not initialized. Check your database connection.");
        }
        return client as Knex;
    }

    private get tableName() {
        return "otps";
    }

    async create(otpData: Omit<IOtp, 'id' | 'createdAt' | 'updatedAt'>): Promise<IOtp> {
        const insertData: IOtpSQLInsert = {
            otp: otpData.otp,
            type: otpData.type,
            expires_at: otpData.expiresAt,
            email: otpData.email,
            phone: otpData.phone,
            user_id: otpData.userId ? parseInt(otpData.userId, 10) : null,
            is_used: otpData.isUsed || false,
            attempts: otpData.attempts || 0
        };

        const [otp] = await this.knex(this.tableName)
            .insert(insertData)
            .returning("*");

        return this.toCore(otp);
    }

    async findById(id: string | number): Promise<IOtp | null> {
        const otpId = typeof id === 'string' ? parseInt(id, 10) : id;
        const otp = await this.knex(this.tableName)
            .where({ id: otpId })
            .first();

        return otp ? this.toCore(otp) : null;
    }

    async findByToken(otp: string): Promise<IOtp | null> {
        const result = await this.knex(this.tableName)
            .where({ otp, is_used: false })
            .first();

        return result ? this.toCore(result) : null;
    }

    async findValidByUser(userId: string | number, type?: OTPType): Promise<IOtp[]> {
        const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        let query = this.knex(this.tableName)
            .where({
                user_id: userIdNum,
                is_used: false
            })
            .where('expires_at', '>', new Date());

        if (type) {
            query = query.where({ type });
        }

        const otps = await query.orderBy('created_at', 'desc');
        return otps.map((o: IOtpSQLRow) => this.toCore(o));
    }

    async findValidByEmail(email: string, type?: OTPType): Promise<IOtp | null> {
        let query = this.knex(this.tableName)
            .where({
                email: email.toLowerCase(),
                is_used: false
            })
            .where('expires_at', '>', new Date());

        if (type) {
            query = query.where({ type });
        }

        const otp = await query.orderBy('created_at', 'desc').first();
        return otp ? this.toCore(otp) : null;
    }

    async findValidByPhone(phone: string, type?: OTPType): Promise<IOtp | null> {
        let query = this.knex(this.tableName)
            .where({
                phone,
                is_used: false
            })
            .where('expires_at', '>', new Date());

        if (type) {
            query = query.where({ type });
        }

        const otp = await query.orderBy('created_at', 'desc').first();
        return otp ? this.toCore(otp) : null;
    }

    async verifyOTP(otp: string, type: OTPType, identifier: string): Promise<IOtp | null> {
        let query = this.knex(this.tableName)
            .where({
                otp,
                type,
                is_used: false
            })
            .where('expires_at', '>', new Date());

        // Check if identifier is email or phone
        if (identifier.includes('@')) {
            query = query.where({ email: identifier.toLowerCase() });
        } else {
            query = query.where({ phone: identifier });
        }

        const [result] = await query.update({
            is_used: true,
            updated_at: new Date()
        }).returning("*");

        return result ? this.toCore(result) : null;
    }

    async update(id: string | number, updates: Partial<Omit<IOtp, 'id' | 'createdAt'>>): Promise<IOtp | null> {
        const otpId = typeof id === 'string' ? parseInt(id, 10) : id;
        const updateData: any = {
            updated_at: new Date()
        };

        if (updates.otp) updateData.otp = updates.otp;
        if (updates.type) updateData.type = updates.type;
        if (updates.expiresAt) updateData.expires_at = updates.expiresAt;
        if (updates.email) updateData.email = updates.email;
        if (updates.phone) updateData.phone = updates.phone;
        if (updates.userId) updateData.user_id = parseInt(updates.userId, 10);
        if (updates.isUsed !== undefined) updateData.is_used = updates.isUsed;
        if (updates.attempts !== undefined) updateData.attempts = updates.attempts;

        const [otp] = await this.knex(this.tableName)
            .where({ id: otpId })
            .update(updateData)
            .returning("*");

        return otp ? this.toCore(otp) : null;
    }

    async markAsUsed(id: string | number): Promise<IOtp | null> {
        return this.update(id, { isUsed: true });
    }

    async delete(id: string | number): Promise<boolean> {
        const otpId = typeof id === 'string' ? parseInt(id, 10) : id;
        const deleted = await this.knex(this.tableName)
            .where({ id: otpId })
            .delete();

        return deleted > 0;
    }

    async invalidateAllForUser(userId: string | number, type?: OTPType): Promise<number> {
        const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        let query = this.knex(this.tableName)
            .where({
                user_id: userIdNum,
                is_used: false
            });

        if (type) {
            query = query.where({ type });
        }

        const updated = await query.update({
            is_used: true,
            updated_at: new Date()
        });

        return updated;
    }

    async cleanupExpiredOTPs(): Promise<number> {
        const deleted = await this.knex(this.tableName)
            .where('expires_at', '<', new Date())
            .delete();

        return deleted;
    }

    async count(filters?: Partial<IOtp>): Promise<number> {
        let query = this.knex(this.tableName).count("id as count");

        if (filters) {
            if (filters.otp) query = query.where({ otp: filters.otp });
            if (filters.type) query = query.where({ type: filters.type });
            if (filters.email) query = query.where({ email: filters.email });
            if (filters.phone) query = query.where({ phone: filters.phone });
            if (filters.userId) query = query.where({ user_id: parseInt(filters.userId, 10) });
            if (filters.isUsed !== undefined) query = query.where({ is_used: filters.isUsed });
        }

        const result = await query.first();
        const count = result?.count;

        if (typeof count === 'number') return count;
        return parseInt(count || "0", 10);
    }

    async exists(id: string | number): Promise<boolean> {
        const otpId = typeof id === 'string' ? parseInt(id, 10) : id;
        const result = await this.knex(this.tableName)
            .where({ id: otpId })
            .first('id');

        return !!result;
    }

    private toCore(row: IOtpSQLRow): IOtp {
        return {
            id: row.id.toString(),
            otp: row.otp,
            type: row.type,
            expiresAt: row.expires_at,
            email: row.email || undefined,
            phone: row.phone || undefined,
            userId: row.user_id?.toString(),
            isUsed: row.is_used,
            attempts: row.attempts || 0,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}