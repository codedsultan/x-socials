/**
 * @file src/models/mongo/schemas/User.schema.ts
 * @description Mongoose schema for Users (without model registration)
 */

import { Schema } from 'mongoose';
import type { IUserMongoDocument } from '../../../interfaces/entities/user/mongo';

export const UserSchema = new Schema<IUserMongoDocument>(
    {
        fname: { type: String, required: true, maxlength: 100 },
        lname: { type: String, required: true, maxlength: 100 },
        email: { type: String, required: true, unique: true, maxlength: 100 },
        isEmailVerified: { type: Boolean, default: false },
        username: { type: String, required: true, unique: true, maxlength: 100 },
        role: { type: String, enum: ['user', 'admin'], default: 'user' },
        password: { type: String, required: true },
        salt: { type: String, default: null },
        accountStatus: {
            type: String,
            enum: ['active', 'suspended', 'deactivated'],
            default: 'active'
        },
        isVerified: { type: Boolean, default: false },
        isPrivate: { type: Boolean, default: false },
        countryCode: { type: String, default: null },
        phone: { type: String, default: null },
        isPhoneVerified: { type: Boolean, default: false },
        about: { type: String, maxlength: 1000, default: null },
        gender: { type: String, default: null },
        dob: { type: String, default: null },
        profession: { type: String, default: null },
        location: { type: String, default: null },
        website: { type: String, default: null },
        avatarPublicId: { type: String, default: null },
        avatarUrl: { type: String, default: null },
        nameChangedAt: { type: Date, default: null },
        emailChangedAt: { type: Date, default: null },
        usernameChangedAt: { type: Date, default: null },
        passwordChangedAt: { type: Date, default: null },
        phoneChangedAt: { type: Date, default: null },
        verification: {
            isVerified: { type: Boolean, default: false },
            category: { type: String },
            verifiedAt: { type: Date },
            lastRequestedAt: { type: Date }
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Virtual for id
UserSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

// Instance methods
UserSchema.methods.isProfileComplete = async function () {
    return !!(this.fname && this.email && this.username);
};

UserSchema.methods.setPassword = async function (password: string) {
    this.password = password;
};

UserSchema.methods.matchPassword = async function (password: string) {
    return this.password === password;
};