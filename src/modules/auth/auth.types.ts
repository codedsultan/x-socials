export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

/** POST /auth/password/forgot */
export interface RequestOtpDto {
  email: string;
}

/** POST /auth/email/verify */
export interface VerifyOtpDto {
  userId: string;
  code: string;
}

/** POST /auth/password/reset */
export interface ResetPasswordDto {
  email: string;
  code: string;
  newPassword: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string | undefined;
    email: string;
    createdAt?: Date;
  };
  tokens: AuthTokens;
}
