// src/services/otp/OtpService.ts
import crypto from 'node:crypto';
import { ApiError } from '../../shared/errors/ApiError';
import { generateSqlId } from '../../utils/uuid';
import type { OtpRepository } from '../../repositories/OtpRepository';
import type { EmailType as OtpPurpose } from '../email/templates';

export const OTP_TTL_MINUTES = 10;
const OTP_DIGITS = 6;

/**
 * Generates a cryptographically-safe numeric OTP code.
 * No external library needed — crypto.randomInt is built-in since Node 14.
 */
export function generateOtpCode(): string {
  const max = Math.pow(10, OTP_DIGITS);
  return crypto.randomInt(0, max).toString().padStart(OTP_DIGITS, '0');
}

export class OtpService {
  constructor(private readonly otpRepo: OtpRepository) { }

  /**
   * Create a fresh OTP for the user.
   * Any existing unused OTPs for the same purpose are invalidated first.
   */
  async issue(userId: string, purpose: OtpPurpose): Promise<string> {
    // Expire previous codes for this user+purpose so only one is valid at a time.
    await this.invalidateExisting(userId, purpose);

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.otpRepo.create({
      id: generateSqlId(),
      userId,
      code,
      purpose,
      used: false,
      expiresAt,
    });

    return code;
  }

  /**
   * Verify a submitted code. Throws 400 if invalid/expired, marks used on success.
   */
  async verify(userId: string, code: string, purpose: OtpPurpose): Promise<void> {
    const otp = await this.otpRepo.findValidOtp(userId, code, purpose);

    if (!otp) {
      throw ApiError.badRequest('Invalid or expired verification code');
    }

    if (new Date() > otp.expiresAt) {
      await this.otpRepo.markUsed(otp.id);
      throw ApiError.badRequest('Verification code has expired');
    }

    await this.otpRepo.markUsed(otp.id);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async invalidateExisting(userId: string, purpose: OtpPurpose): Promise<void> {
    // findMany isn't defined on OtpRepository but is inherited from BaseRepository
    const existing = await (this.otpRepo as any).findMany({ userId, purpose, used: false });
    await Promise.all(
      (existing as { id: string }[]).map(otp => this.otpRepo.markUsed(otp.id))
    );
  }
}
