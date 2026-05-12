/**
 * @file src/repositories/mongo/user.repository.ts
 * @description MongoDB implementation using your DbManager
 */

import DbManager from "../../config/db/DbManager";
import type { MongooseAdapter } from "../../config/db/adapters/MongooseAdapter";
import type { IUserRepository } from "../../interfaces/repositories/user.repository";
import type { IUser } from "../../interfaces/entities/user/core";

export class MongoUserRepository implements IUserRepository {
    private get adapter(): MongooseAdapter {
        const adapter = DbManager.getInstance().resolveForModel("UserModel");

        if (!adapter) {
            throw new Error("UserModel not bound to any connection. Call DbManager.bindModel() first.");
        }

        return adapter as MongooseAdapter;
    }

    private get connection() {
        const client = this.adapter.getClient();

        if (!client) {
            throw new Error("Mongoose connection not initialized. Check your database connection.");
        }

        return client;
    }

    private get UserModel() {
        // Get the model registered with this connection
        return this.connection.model("User");
    }

    async findById(id: string): Promise<IUser | null> {
        const user = await this.UserModel.findById(id).lean();
        if (!user) return null;
        return this.toCoreUser(user);
    }

    async findByEmail(email: string): Promise<IUser | null> {
        const user = await this.UserModel.findOne({ email }).lean();
        if (!user) return null;
        return this.toCoreUser(user);
    }

    async findByUsername(username: string): Promise<IUser | null> {
        const user = await this.UserModel.findOne({ username }).lean();
        if (!user) return null;
        return this.toCoreUser(user);
    }

    async create(userData: Partial<IUser>): Promise<IUser> {
        const user = await this.UserModel.create(userData);
        const userObject = user.toObject();
        return this.toCoreUser(userObject);
    }

    async update(id: string, updates: Partial<IUser>): Promise<IUser | null> {
        const user = await this.UserModel.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, lean: true }
        );
        if (!user) return null;
        return this.toCoreUser(user);
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.UserModel.findByIdAndDelete(id);
        return !!result;
    }

    async findAll(options?: { limit?: number; offset?: number }): Promise<IUser[]> {
        let query = this.UserModel.find();
        if (options?.limit) query = query.limit(options.limit);
        if (options?.offset) query = query.skip(options.offset);

        const users = await query.lean();
        return users.map((user) => this.toCoreUser(user));
    }

    async count(filters?: Partial<IUser>): Promise<number> {
        // Convert IUser filters to MongoDB filter format
        const mongoFilters: Record<string, any> = {};

        if (filters) {
            for (const [key, value] of Object.entries(filters)) {
                if (value !== undefined && value !== null) {
                    mongoFilters[key] = value;
                }
            }
        }

        return this.UserModel.countDocuments(mongoFilters);
    }

    async verifyEmail(id: string): Promise<IUser | null> {
        const user = await this.UserModel.findByIdAndUpdate(
            id,
            { $set: { isEmailVerified: true, isVerified: true } },
            { new: true, lean: true }
        );
        if (!user) return null;
        return this.toCoreUser(user);
    }

    async updatePassword(id: string, hashedPassword: string): Promise<IUser | null> {
        const user = await this.UserModel.findByIdAndUpdate(
            id,
            {
                $set: {
                    password: hashedPassword,
                    passwordChangedAt: new Date()
                }
            },
            { new: true, lean: true }
        );
        if (!user) return null;
        return this.toCoreUser(user);
    }

    async updateRole(id: string, role: IUser['role']): Promise<IUser | null> {
        const user = await this.UserModel.findByIdAndUpdate(
            id,
            { $set: { role } },
            { new: true, lean: true }
        );
        if (!user) return null;
        return this.toCoreUser(user);
    }

    private toCoreUser(mongoUser: any): IUser {
        return {
            id: mongoUser._id.toString(),
            fname: mongoUser.fname,
            lname: mongoUser.lname,
            email: mongoUser.email,
            isEmailVerified: mongoUser.isEmailVerified,
            username: mongoUser.username,
            role: mongoUser.role,
            password: mongoUser.password,
            salt: mongoUser.salt,
            accountStatus: mongoUser.accountStatus,
            isVerified: mongoUser.isVerified,
            isPrivate: mongoUser.isPrivate,
            countryCode: mongoUser.countryCode,
            phone: mongoUser.phone,
            isPhoneVerified: mongoUser.isPhoneVerified,
            about: mongoUser.about,
            gender: mongoUser.gender,
            dob: mongoUser.dob,
            profession: mongoUser.profession,
            location: mongoUser.location,
            website: mongoUser.website,
            avatarPublicId: mongoUser.avatarPublicId,
            avatarUrl: mongoUser.avatarUrl,
            nameChangedAt: mongoUser.nameChangedAt,
            emailChangedAt: mongoUser.emailChangedAt,
            usernameChangedAt: mongoUser.usernameChangedAt,
            passwordChangedAt: mongoUser.passwordChangedAt,
            phoneChangedAt: mongoUser.phoneChangedAt,
            createdAt: mongoUser.createdAt,
            updatedAt: mongoUser.updatedAt,
        };
    }
}