#!/bin/bash

# Create directories
mkdir -p src/interfaces/entities/user
mkdir -p src/interfaces/entities/auth
mkdir -p src/interfaces/entities/post
mkdir -p src/interfaces/entities/shared

# Create shared timestamps
cat > src/interfaces/entities/shared/timestamps.ts << 'EOF'
/**
 * @file src/interfaces/entities/shared/timestamps.ts
 * @description Shared timestamp interfaces
 */

export interface ITimestamps {
  created_at: Date;
  updated_at: Date;
}

export interface ITimestampsDocument {
  createdAt: Date;
  updatedAt: Date;
}
EOF

# Create user enums
cat > src/interfaces/entities/user/enums.ts << 'EOF'
/**
 * @file src/interfaces/entities/user/enums.ts
 * @description User-related enums and value types
 */

export type UserRole = "user" | "admin";

export type UserAccountStatus = "active" | "suspended" | "deactivated";
EOF

# Create user base
cat > src/interfaces/entities/user/base.ts << 'EOF'
/**
 * @file src/interfaces/entities/user/base.ts
 * @description Core user fields shared between SQL and MongoDB
 */

import type { UserRole, UserAccountStatus } from './enums';

export interface IUserBase {
  /** First name — max 100 chars */
  fname: string;
  /** Last name — max 100 chars */
  lname: string;
  /** Unique email address — max 100 chars */
  email: string;
  /** Whether the email address has been verified */
  isEmailVerified: boolean;
  /** Unique username — max 100 chars */
  username: string;
  /** Role-based access control */
  role: UserRole;
  /** Hashed password (pbkdf2 / bcrypt) */
  password: string;
  /** Password salt (used with pbkdf2) */
  salt?: string | null;
  /** Account status */
  accountStatus: UserAccountStatus;
  /** Whether the user's identity has been verified */
  isVerified: boolean;
  /** Whether the account is private */
  isPrivate: boolean;
  /** Optional — E.164 country dial code e.g. "+1" */
  countryCode?: string | null;
  /** Optional — 10-digit phone number */
  phone?: string | null;
  /** Whether the phone number has been verified */
  isPhoneVerified: boolean;
  /** Optional biography — max 1000 chars */
  about?: string | null;
  /** Optional gender */
  gender?: string | null;
  /** Optional date of birth */
  dob?: string | null;
  /** Optional profession */
  profession?: string | null;
  /** Optional location string */
  location?: string | null;
  /** Optional website URL */
  website?: string | null;
  /** Avatar public ID (Cloudinary / S3 key) */
  avatarPublicId?: string | null;
  /** Avatar URL */
  avatarUrl?: string | null;
  /** Timestamps */
  nameChangedAt?: Date | null;
  emailChangedAt?: Date | null;
  usernameChangedAt?: Date | null;
  passwordChangedAt?: Date | null;
  phoneChangedAt?: Date | null;
}
EOF

# Create user row
cat > src/interfaces/entities/user/row.ts << 'EOF'
/**
 * @file src/interfaces/entities/user/row.ts
 * @description Relational (Knex) user row types
 */

import type { IUserBase } from './base';
import type { ITimestamps } from '../shared/timestamps';

/**
 * Represents a row in the `users` table.
 * All optional/nullable columns are explicitly typed as `… | null`.
 */
export interface IUserRow extends IUserBase, ITimestamps {
  id: number;
  /** Legacy API key column */
  apikey?: string | null;
  /** Whether the account is banned */
  banned: boolean;
  banned_by_id?: number | null;
  /** Verification token (email verification flow) */
  verification_token?: string | null;
  verification_expires?: Date | null;
  verified: boolean;
  /** Reset-password flow */
  reset_password_token?: string | null;
  reset_password_expires?: Date | null;
  /** Change-email flow */
  change_email_token?: string | null;
  change_email_expires?: Date | null;
  change_email_address?: string | null;
}

/**
 * Payload for inserting a new user row.
 * `id`, `created_at`, `updated_at` are database-generated.
 */
export type IUserInsert = Omit<IUserRow, "id" | "created_at" | "updated_at">;

/**
 * Payload for updating an existing user row.
 * All fields are optional.
 */
export type IUserUpdate = Partial<IUserInsert>;
EOF

# Create user document
cat > src/interfaces/entities/user/document.ts << 'EOF'
/**
 * @file src/interfaces/entities/user/document.ts
 * @description Mongoose user document interface
 */

import type { Document, Types } from "mongoose";
import type { IUserBase } from './base';
import type { ITimestampsDocument } from '../shared/timestamps';
import type { IAuthTokenDocument } from '../auth/token';

export interface IUserDocument extends IUserBase, Document, ITimestampsDocument {
  _id: Types.ObjectId;
  /** Verification sub-document (Mongo-specific) */
  verification?: {
    isVerified: boolean;
    category?: string;
    verifiedAt?: Date;
    lastRequestedAt?: Date;
  };

  // ── Instance methods ──
  /** Generate (or refresh) a JWT auth token stored in the AuthToken collection. */
  generateToken(): Promise<IAuthTokenDocument>;
  /** Retrieve the current valid auth token, or generate a fresh one. */
  getToken(refreshToken?: boolean): Promise<IAuthTokenDocument>;
  /** Returns true when fname, email, and username are all set. */
  isProfileComplete(): Promise<boolean>;
  /** Hash and persist a new password. */
  setPassword(password: string): Promise<void>;
  /** Verify a plaintext password against the stored hash. */
  matchPassword(password: string): Promise<boolean>;
}
EOF

# Create user index
cat > src/interfaces/entities/user/index.ts << 'EOF'
/**
 * @file src/interfaces/entities/user/index.ts
 * @description User entity exports
 */

export * from './enums';
export * from './base';
export * from './row';
export * from './document';
EOF

# Create auth token
cat > src/interfaces/entities/auth/token.ts << 'EOF'
/**
 * @file src/interfaces/entities/auth/token.ts
 * @description Auth token entity interfaces
 */

import type { Document, Types } from "mongoose";
import type { ITimestamps, ITimestampsDocument } from '../shared/timestamps';

export interface IAuthTokenRow extends ITimestamps {
  id: number;
  token: string;
  user_id: number;
  expires_at: number; // Unix timestamp
}

export interface IAuthTokenDocument extends Document, ITimestampsDocument {
  _id: Types.ObjectId;
  token: string;
  userId: Types.ObjectId;
  expiresAt: number;
  isExpired(): Promise<boolean>;
}
EOF

# Create auth otp
cat > src/interfaces/entities/auth/otp.ts << 'EOF'
/**
 * @file src/interfaces/entities/auth/otp.ts
 * @description OTP (One-Time Password) entity interfaces
 */

import type { Document, Types } from "mongoose";
import type { ITimestamps, ITimestampsDocument } from '../shared/timestamps';

export interface IOtpRow extends ITimestamps {
  id: number;
  otp: string;
  expires_at: Date;
  email?: string | null;
  phone?: string | null;
  user_id?: number | null;
  is_used: boolean;
}

export interface IOtpDocument extends Document, ITimestampsDocument {
  _id: Types.ObjectId;
  otp: string;
  expiresAt: Date;
  email?: string;
  phone?: string;
  userId?: Types.ObjectId;
  isUsed: boolean;
  isExpired(): Promise<boolean>;
  isAlreadyUsed(): Promise<boolean>;
}
EOF

# Create auth index
cat > src/interfaces/entities/auth/index.ts << 'EOF'
/**
 * @file src/interfaces/entities/auth/index.ts
 * @description Auth entity exports
 */

export * from './token';
export * from './otp';
EOF

# Create post types
cat > src/interfaces/entities/post/types.ts << 'EOF'
/**
 * @file src/interfaces/entities/post/types.ts
 * @description Post entity interfaces
 */

import type { Document, Types } from "mongoose";
import type { ITimestamps, ITimestampsDocument } from '../shared/timestamps';

export type PostStatus = "active" | "inactive" | "deleted";

export interface IPostRow extends ITimestamps {
  id: number;
  user_id: number;
  status: PostStatus;
}

export interface IPostDocument extends Document, ITimestampsDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  status: PostStatus;
}
EOF

# Create post index
cat > src/interfaces/entities/post/index.ts << 'EOF'
/**
 * @file src/interfaces/entities/post/index.ts
 * @description Post entity exports
 */

export * from './types';
EOF

# Create main entities index
cat > src/interfaces/entities/index.ts << 'EOF'
/**
 * @file src/interfaces/entities/index.ts
 * @description Main entities barrel export
 */

export * from './user';
export * from './auth';
export * from './post';
export * from './shared/timestamps';
EOF

echo "All entity files created successfully!"