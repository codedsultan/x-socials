export interface RegisterDto {
  name:     string;
  email:    string;
  password: string;
}

export interface LoginDto {
  email:    string;
  password: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
}

export interface AuthResponse {
  user: {
    id:        string;
    name:      string | undefined;
    email:     string;
    createdAt?: Date;
  };
  tokens: AuthTokens;
}
