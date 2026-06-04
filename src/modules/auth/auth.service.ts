import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { RepositoryFactory } from '../../factories/RepositoryFactory';
import type { UserRepository } from '../../repositories/UserRepository';
import type { TokenRepository } from '../../repositories/TokenRepository';
import type { OtpRepository } from '../../repositories/OtpRepository';
import { ApiError } from '../../shared/errors/ApiError';
import ConfigService from '../../config/config.service';
import { generateUid } from '../../utils/uuid';
import { OtpService } from '../../services/otp/OtpService';
import { enqueueEmail } from '../../queue/emailQueue';
import { OTP_TTL_MINUTES } from '../../services/email/templates/partials/otp-block.partial';
import Logger from '../../logger';
import type {
  RegisterDto,
  LoginDto,
  AuthResponse,
  AuthTokens,
  RequestOtpDto,
  VerifyOtpDto,
  ResetPasswordDto,
} from './auth.types';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_DAYS = 30;

export class AuthService {
  private get userRepo(): UserRepository {
    return this.repoFactory.getRepository<any>('User') as UserRepository;
  }

  private get tokenRepo(): TokenRepository {
    return this.repoFactory.getRepository<any>('Token') as TokenRepository;
  }

  private get otpRepo(): OtpRepository {
    return this.repoFactory.getRepository<any>('Otp') as OtpRepository;
  }

  constructor(private readonly repoFactory: RepositoryFactory) { }

  // ─── Register / Login ────────────────────────────────────────────────────

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

    // Queue email verification — fire-and-forget with retry via BullMQ
    this.queueEmailVerification(user.id, user.email, user.name ?? undefined).catch((err) => {
      Logger.getInstance().error(
        `[AuthService] Failed to enqueue verification email for ${user.email}: ${err.message}`
      );
    });

    return {
      user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) throw ApiError.unauthorized('Invalid email or password');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw ApiError.unauthorized('Invalid email or password');

    const tokens = await this.issueTokens(user.id, user.email);

    return {
      user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt },
      tokens,
    };
  }

  // ─── Token rotation ──────────────────────────────────────────────────────

  async refreshTokens(rawRefreshToken: string): Promise<AuthTokens> {
    const stored = await this.tokenRepo.findByValue(rawRefreshToken);
    if (!stored || stored.type !== 'refresh') {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    if (new Date() > stored.expiresAt) {
      await this.tokenRepo.delete(stored.id);
      throw ApiError.unauthorized('Refresh token has expired, please log in again');
    }

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

  // ─── Email verification ──────────────────────────────────────────────────

  async requestEmailVerification(userId: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    await this.queueEmailVerification(userId, user.email, user.name ?? undefined);
  }

  async verifyEmail(dto: VerifyOtpDto): Promise<void> {
    const user = await this.userRepo.findById(dto.userId);
    if (!user) throw ApiError.notFound('User not found');

    const otpService = new OtpService(this.otpRepo);
    const otpId = await otpService.validate(dto.userId, dto.code, 'email_verification');

    await this.userRepo.update(dto.userId, { emailVerifiedAt: new Date() } as any);
    await otpService.consume(otpId);
  }

  // ─── Password reset ──────────────────────────────────────────────────────

  async requestPasswordReset(dto: RequestOtpDto): Promise<void> {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) return; // silent — prevent email enumeration

    const otpService = new OtpService(this.otpRepo);
    const code = await otpService.issue(user.id, 'password_reset');

    await enqueueEmail('password_reset', user.email, {
      code,
      expiryMinutes: OTP_TTL_MINUTES,
      userName: user.name ?? undefined,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) throw ApiError.badRequest('Invalid or expired verification code');

    const otpService = new OtpService(this.otpRepo);
    const otpId = await otpService.validate(user.id, dto.code, 'password_reset');

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userRepo.update(user.id, { passwordHash } as any);
    await this.tokenRepo.revokeAllForUser(user.id);
    await otpService.consume(otpId);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async queueEmailVerification(
    userId: string,
    email: string,
    userName?: string,
  ): Promise<void> {
    const otpService = new OtpService(this.otpRepo);
    const code = await otpService.issue(userId, 'email_verification');

    await enqueueEmail('email_verification', email, {
      code,
      expiryMinutes: OTP_TTL_MINUTES,
      userName,
    });
  }

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
