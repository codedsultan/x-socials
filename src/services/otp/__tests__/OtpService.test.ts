import { describe, it, expect, vi } from 'vitest';
import { OtpService, generateOtpCode, OTP_TTL_MINUTES } from '../OtpService';
import type { OtpRepository, Otp } from '../../../repositories/OtpRepository';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeOtp(overrides: Partial<Otp> = {}): Otp {
  return {
    id: 'otp-1',
    userId: 'user-1',
    code: '123456',
    purpose: 'email_verification',
    used: false,
    expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  };
}

function makeOtpRepo(overrides: Partial<OtpRepository> = {}): OtpRepository {
  return {
    create: vi.fn().mockResolvedValue(makeOtp()),
    findValidOtp: vi.fn().mockResolvedValue(null),
    markUsed: vi.fn().mockResolvedValue(makeOtp({ used: true })),
    findMany: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    findOne: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(true),
    exists: vi.fn().mockResolvedValue(false),
    count: vi.fn().mockResolvedValue(0),
    findByIds: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as OtpRepository;
}

// ─── generateOtpCode ─────────────────────────────────────────────────────────

describe('generateOtpCode()', () => {
  it('returns exactly 6 digits', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('produces different codes across calls', () => {
    const codes = new Set(Array.from({ length: 50 }, generateOtpCode));
    // Probabilistically: 50 calls should yield >10 unique values
    expect(codes.size).toBeGreaterThan(10);
  });
});

// ─── OtpService ──────────────────────────────────────────────────────────────

describe('OtpService', () => {
  describe('issue()', () => {
    it('invalidates existing OTPs before creating a new one', async () => {
      const existingOtp = makeOtp({ id: 'old-otp' });
      const repo = makeOtpRepo({
        findMany: vi.fn().mockResolvedValue([existingOtp]),
      });
      const svc = new OtpService(repo);

      await svc.issue('user-1', 'email_verification');

      expect(repo.markUsed).toHaveBeenCalledWith('old-otp');
      expect(repo.create).toHaveBeenCalledOnce();
    });

    it('returns the generated code', async () => {
      const repo = makeOtpRepo();
      const svc = new OtpService(repo);

      const code = await svc.issue('user-1', 'email_verification');

      expect(code).toMatch(/^\d{6}$/);
    });

    it('persists OTP with correct TTL and purpose', async () => {
      const repo = makeOtpRepo();
      const svc = new OtpService(repo);
      const before = Date.now();

      await svc.issue('user-1', 'password_reset');

      const createArg = (repo.create as any).mock.calls[0][0];
      expect(createArg.purpose).toBe('password_reset');
      expect(createArg.used).toBe(false);
      expect(createArg.userId).toBe('user-1');

      const ttlMs = createArg.expiresAt.getTime() - before;
      // Should be ~10 minutes (allow 1s tolerance for test execution time)
      expect(ttlMs).toBeGreaterThanOrEqual((OTP_TTL_MINUTES * 60 - 1) * 1000);
      expect(ttlMs).toBeLessThanOrEqual((OTP_TTL_MINUTES * 60 + 1) * 1000);
    });
  });

  describe('verify()', () => {
    it('marks OTP as used on success', async () => {
      const otp = makeOtp();
      const repo = makeOtpRepo({ findValidOtp: vi.fn().mockResolvedValue(otp) });
      const svc = new OtpService(repo);

      await svc.verify('user-1', '123456', 'email_verification');

      expect(repo.markUsed).toHaveBeenCalledWith('otp-1');
    });

    it('throws 400 when OTP is not found', async () => {
      const repo = makeOtpRepo({ findValidOtp: vi.fn().mockResolvedValue(null) });
      const svc = new OtpService(repo);

      await expect(svc.verify('user-1', '000000', 'email_verification'))
        .rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 400 and marks used when OTP is expired', async () => {
      const expired = makeOtp({ expiresAt: new Date(Date.now() - 1000) });
      const repo = makeOtpRepo({ findValidOtp: vi.fn().mockResolvedValue(expired) });
      const svc = new OtpService(repo);

      await expect(svc.verify('user-1', '123456', 'email_verification'))
        .rejects.toMatchObject({ statusCode: 400 });

      expect(repo.markUsed).toHaveBeenCalledWith('otp-1');
    });

    it('does not throw for a valid non-expired OTP', async () => {
      const otp = makeOtp();
      const repo = makeOtpRepo({ findValidOtp: vi.fn().mockResolvedValue(otp) });
      const svc = new OtpService(repo);

      await expect(svc.verify('user-1', '123456', 'email_verification')).resolves.toBeUndefined();
    });
  });
});
