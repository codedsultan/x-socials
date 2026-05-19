import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { RepositoryFactory } from '../../factories/RepositoryFactory';
import type { UserRepository } from '../../repositories/UserRepository';
import type { TokenRepository } from '../../repositories/TokenRepository';
import { ApiError } from '../../shared/errors/ApiError';
import ConfigService from '../../config/config.service';
import { generateUid } from '../../utils/uuid';
import type { RegisterDto, LoginDto, AuthResponse, AuthTokens } from './auth.types';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_DAYS = 30;

export class AuthService {
  private get userRepo(): UserRepository {
    return this.repoFactory.getRepository<any>('User') as UserRepository;
  }

  private get tokenRepo(): TokenRepository {
    return this.repoFactory.getRepository<any>('Token') as TokenRepository;
  }

  constructor(private readonly repoFactory: RepositoryFactory) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const exists = await this.userRepo.emailExists(dto.email);
    if (exists) {
      throw ApiError.conflict('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.userRepo.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });

    const tokens = await this.issueTokens(user.id, user.email);

    return {
      user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const tokens = await this.issueTokens(user.id, user.email);

    return {
      user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
      tokens,
    };
  }

  async refreshTokens(rawRefreshToken: string): Promise<AuthTokens> {
    const stored = await this.tokenRepo.findByValue(rawRefreshToken);
    if (!stored || stored.type !== 'refresh') {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    if (new Date() > stored.expiresAt) {
      await this.tokenRepo.delete(stored.id);
      throw ApiError.unauthorized('Refresh token has expired, please log in again');
    }

    // Rotate: revoke the old token and issue fresh pair
    await this.tokenRepo.delete(stored.id);

    const { secret } = this.getJwtConfig();
    let payload: { sub: string; email: string };
    try {
      payload = jwt.verify(rawRefreshToken, secret) as any;
    } catch {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    return this.issueTokens(payload.sub, payload.email);
  }

  async logout(userId: string): Promise<void> {
    await this.tokenRepo.revokeAllForUser(userId);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async issueTokens(userId: string, email: string): Promise<AuthTokens> {
    const { secret, expiresIn } = this.getJwtConfig();

    const accessToken = jwt.sign({ sub: userId, email }, secret, { expiresIn } as any);

    const rawRefreshToken = generateUid();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await this.tokenRepo.create({
      userId,
      token: rawRefreshToken,
      type: 'refresh',
      expiresAt,
    });

    // Parse expiresIn string to seconds for the client
    const expiresInSeconds = this.parseExpiresIn(expiresIn);

    return { accessToken, refreshToken: rawRefreshToken, expiresIn: expiresInSeconds };
  }

  private getJwtConfig(): { secret: string; expiresIn: string } {
    const config = ConfigService.getServerConfig();
    const secret = (config as any).JWT_SECRET || process.env['JWT_SECRET'];
    const expiresIn = (config as any).JWT_EXPIRES_IN || process.env['JWT_EXPIRES_IN'] || '7d';
    if (!secret) throw ApiError.internal('JWT secret is not configured');
    return { secret, expiresIn };
  }

  private parseExpiresIn(value: string): number {
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 3600;
    const [, num, unit] = match;
    const n = parseInt(num!, 10);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * (multipliers[unit!] ?? 86400);
  }
}
