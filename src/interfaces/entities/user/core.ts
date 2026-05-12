/**
 * @file src/interfaces/entities/user/core.ts
 * @description Database-agnostic user entity - used by business logic
 */

export type UserRole = "user" | "admin";
export type UserAccountStatus = "active" | "suspended" | "deactivated";

export interface IUser {
    id: string | number;
    fname: string;
    lname: string;
    email: string;
    isEmailVerified: boolean;
    username: string;
    role: UserRole;
    password: string;
    salt?: string | null;
    accountStatus: UserAccountStatus;
    isVerified: boolean;
    isPrivate: boolean;
    countryCode?: string | null;
    phone?: string | null;
    isPhoneVerified: boolean;
    about?: string | null;
    gender?: string | null;
    dob?: string | null;
    profession?: string | null;
    location?: string | null;
    website?: string | null;
    avatarPublicId?: string | null;
    avatarUrl?: string | null;
    nameChangedAt?: Date | null;
    emailChangedAt?: Date | null;
    usernameChangedAt?: Date | null;
    passwordChangedAt?: Date | null;
    phoneChangedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}