/**
 * @file src/repositories/mongo/otp.repository.ts
 * @description MongoDB implementation for OTPs
 */

import DbManager from "../../config/db/DbManager";
import type { MongooseAdapter } from "../../config/db/adapters/MongooseAdapter";
import type { IOtpRepository } from "../../interfaces/repositories/otp.repository";
import type { IOtp, OTPType } from "../../interfaces/entities/auth/otp";
import { Types } from "mongoose";

export class MongoOtpRepository implements IOtpRepository {
    private get adapter(): MongooseAdapter {
        const adapter = DbManager.getInstance().resolveForModel("OTPModel");
        if (!adapter) {
            throw new Error("OTPModel not bound to any connection. Call DbManager.bindModel() first.");
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

    private get OTPModel() {
        return this.connection.model("OTP");
    }

    async create(otpData: Omit<IOtp, 'id' | 'createdAt' | 'updatedAt'>): Promise<IOtp> {
        // Transform to MongoDB document format
        const mongoOtpData: any = {
            otp: otpData.otp,
            type: otpData.type,
            expiresAt: otpData.expiresAt,
            isUsed: otpData.isUsed || false,
            attempts: otpData.attempts || 0
        };

        if (otpData.email) mongoOtpData.email = otpData.email;
        if (otpData.phone) mongoOtpData.phone = otpData.phone;
        if (otpData.userId) mongoOtpData.userId = new Types.ObjectId(otpData.userId);

        const otp = await this.OTPModel.create(mongoOtpData);
        return this.toCore(otp.toObject());
    }

    async findById(id: string | number): Promise<IOtp | null> {
        const otp = await this.OTPModel.findById(id.toString()).lean();
        return otp ? this.toCore(otp) : null;
    }

    async findByToken(otp: string): Promise<IOtp | null> {
        const result = await this.OTPModel.findOne({ otp, isUsed: false }).lean();
        return result ? this.toCore(result) : null;
    }

    async findValidByUser(userId: string | number, type?: OTPType): Promise<IOtp[]> {
        const query: any = {
            userId: userId.toString(),
            isUsed: false,
            expiresAt: { $gt: new Date() }
        };
        if (type) query.type = type;

        const otps = await this.OTPModel.find(query).sort({ createdAt: -1 }).lean();
        return otps.map(o => this.toCore(o));
    }

    async findValidByEmail(email: string, type?: OTPType): Promise<IOtp | null> {
        const query: any = {
            email: email.toLowerCase(),
            isUsed: false,
            expiresAt: { $gt: new Date() }
        };
        if (type) query.type = type;

        const otp = await this.OTPModel.findOne(query).sort({ createdAt: -1 }).lean();
        return otp ? this.toCore(otp) : null;
    }

    async findValidByPhone(phone: string, type?: OTPType): Promise<IOtp | null> {
        const query: any = {
            phone,
            isUsed: false,
            expiresAt: { $gt: new Date() }
        };
        if (type) query.type = type;

        const otp = await this.OTPModel.findOne(query).sort({ createdAt: -1 }).lean();
        return otp ? this.toCore(otp) : null;
    }

    async verifyOTP(otp: string, type: OTPType, identifier: string): Promise<IOtp | null> {
        const query: any = {
            otp,
            type,
            isUsed: false,
            expiresAt: { $gt: new Date() }
        };

        // Check if identifier is email or phone
        if (identifier.includes('@')) {
            query.email = identifier.toLowerCase();
        } else {
            query.phone = identifier;
        }

        const result = await this.OTPModel.findOneAndUpdate(
            query,
            { $set: { isUsed: true } },
            { new: true, lean: true }
        );

        return result ? this.toCore(result) : null;
    }

    async update(id: string | number, updates: Partial<Omit<IOtp, 'id' | 'createdAt'>>): Promise<IOtp | null> {
        // Transform updates to MongoDB format
        const mongoUpdates: any = {};

        if (updates.otp) mongoUpdates.otp = updates.otp;
        if (updates.type) mongoUpdates.type = updates.type;
        if (updates.expiresAt) mongoUpdates.expiresAt = updates.expiresAt;
        if (updates.email) mongoUpdates.email = updates.email;
        if (updates.phone) mongoUpdates.phone = updates.phone;
        if (updates.userId) mongoUpdates.userId = new Types.ObjectId(updates.userId);
        if (updates.isUsed !== undefined) mongoUpdates.isUsed = updates.isUsed;
        if (updates.attempts !== undefined) mongoUpdates.attempts = updates.attempts;

        const otp = await this.OTPModel.findByIdAndUpdate(
            id.toString(),
            { $set: mongoUpdates },
            { new: true, lean: true }
        );
        return otp ? this.toCore(otp) : null;
    }

    async markAsUsed(id: string | number): Promise<IOtp | null> {
        return this.update(id, { isUsed: true });
    }

    async delete(id: string | number): Promise<boolean> {
        const result = await this.OTPModel.findByIdAndDelete(id.toString());
        return !!result;
    }

    async invalidateAllForUser(userId: string | number, type?: OTPType): Promise<number> {
        const query: any = { userId: userId.toString(), isUsed: false };
        if (type) query.type = type;

        const result = await this.OTPModel.updateMany(
            query,
            { $set: { isUsed: true } }
        );
        return result.modifiedCount;
    }

    async cleanupExpiredOTPs(): Promise<number> {
        const result = await this.OTPModel.deleteMany({
            expiresAt: { $lt: new Date() }
        });
        return result.deletedCount;
    }

    async count(filters?: Partial<IOtp>): Promise<number> {
        const mongoFilters: any = {};
        if (filters) {
            for (const [key, value] of Object.entries(filters)) {
                if (value !== undefined && value !== null) {
                    if (key === 'userId' && value) {
                        mongoFilters.userId = value.toString();
                    } else {
                        mongoFilters[key] = value;
                    }
                }
            }
        }
        return this.OTPModel.countDocuments(mongoFilters);
    }

    async exists(id: string | number): Promise<boolean> {
        const count = await this.OTPModel.countDocuments({ _id: id.toString() });
        return count > 0;
    }

    private toCore(mongoOtp: any): IOtp {
        return {
            id: mongoOtp._id.toString(),
            otp: mongoOtp.otp,
            type: mongoOtp.type,
            expiresAt: mongoOtp.expiresAt,
            email: mongoOtp.email,
            phone: mongoOtp.phone,
            userId: mongoOtp.userId?.toString(),
            isUsed: mongoOtp.isUsed,
            attempts: mongoOtp.attempts || 0,
            createdAt: mongoOtp.createdAt,
            updatedAt: mongoOtp.updatedAt
        };
    }
}