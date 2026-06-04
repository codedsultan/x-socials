// src/modules/auth/__tests__/auth.service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AuthService } from '../auth.service';

// ─── Mock the queue — no Redis needed in tests ────────────────────────────────

vi.mock('../../../queue/emailQueue', () => ({
  enqueueEmail: vi.fn().mockResolvedValue(undefined),
}));

import { enqueueEmail } from '../../../queue/emailQueue';
const mockEnqueue = vi.mocked(enqueueEmail);

// ── Repo fakes ────────────────────────────────────────────────────────────────

function makeUserRepo(overrides: Record<string, any> = {}) {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    emailExists: vi.fn().mockResolvedValue(false),
    create: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com', name: 'Alice', passwordHash: 'h', createdAt: new Date() }),
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com', name: 'Alice' }),
    delete: vi.fn().mockResolvedValue(true),
    exists: vi.fn().mockResolvedValue(false),
    findOne: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeTokenRepo(overrides: Record<string, any> = {}) {
  return {
    create: vi.fn().mockResolvedValue({ id: 't-1' }),
    findByValue: vi.fn().mockResolvedValue(null),
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
    findMany: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    findOne: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(true),
    exists: vi.fn().mockResolvedValue(false),
    update: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeOtpRepo(overrides: Record<string, any> = {}) {
  return {
    create: vi.fn().mockResolvedValue({ id: 'otp-1', code: '123456' }),
    findValidOtp: vi.fn().mockResolvedValue(null),
    markUsed: vi.fn().mockResolvedValue({ used: true }),
    findMany: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    findOne: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(true),
    exists: vi.fn().mockResolvedValue(false),
    update: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeFactory(
  userOverrides: Record<string, any> = {},
  tokenOverrides: Record<string, any> = {},
  otpOverrides: Record<string, any> = {},
) {
  const userRepo = makeUserRepo(userOverrides);
  const tokenRepo = makeTokenRepo(tokenOverrides);
  const otpRepo = makeOtpRepo(otpOverrides);
  return {
    getRepository: vi.fn((name: string) => {
      if (name === 'User') return userRepo;
      if (name === 'Token') return tokenRepo;
      if (name === 'Otp') return otpRepo;
      throw new Error(`Unknown repo: ${name}`);
    }),
    _userRepo: userRepo,
    _tokenRepo: tokenRepo,
    _otpRepo: otpRepo,
  };
}

vi.mock('../../../config/config.service', () => ({
  default: {
    getServerConfig: () => ({
      JWT_SECRET: 'test-secret-at-least-32-characters-long!!',
      JWT_EXPIRES_IN: '1h',
    }),
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockEnqueue.mockClear();
});

describe('AuthService', () => {

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      const factory = makeFactory();
      const svc = new AuthService(factory as any);

      const result = await svc.register({ name: 'Alice', email: 'a@b.com', password: 'Password1' });

      expect(result.user.email).toBe('a@b.com');
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
      expect(factory._userRepo.create).toHaveBeenCalledOnce();
      expect(factory._tokenRepo.create).toHaveBeenCalledOnce();
    });

    it('throws 409 if email already exists', async () => {
      const factory = makeFactory({ emailExists: vi.fn().mockResolvedValue(true) });
      const svc = new AuthService(factory as any);

      await expect(svc.register({ name: 'Alice', email: 'a@b.com', password: 'Password1' }))
        .rejects.toMatchObject({ statusCode: 409 });
    });

    it('hashes the password — does not store plaintext', async () => {
      const factory = makeFactory();
      const svc = new AuthService(factory as any);

      await svc.register({ name: 'Alice', email: 'a@b.com', password: 'Password1' });

      const createCall = factory._userRepo.create.mock.calls[0][0];
      expect(createCall.passwordHash).not.toBe('Password1');
      expect(createCall.passwordHash).toMatch(/^\$2[ab]\$/);
    });

    it('enqueues an email_verification job after registration', async () => {
      const factory = makeFactory();
      const svc = new AuthService(factory as any);

      await svc.register({ name: 'Alice', email: 'a@b.com', password: 'Password1' });

      // Allow the fire-and-forget to settle
      await new Promise(r => setTimeout(r, 10));

      expect(mockEnqueue).toHaveBeenCalledWith(
        'email_verification',
        'a@b.com',
        expect.objectContaining({ code: expect.any(String), expiryMinutes: expect.any(Number) }),
      );
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws 401 when user does not exist', async () => {
      const factory = makeFactory();
      const svc = new AuthService(factory as any);

      await expect(svc.login({ email: 'x@y.com', password: 'Password1' }))
        .rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws 401 on wrong password', async () => {
      const factory = makeFactory({
        findByEmail: vi.fn().mockResolvedValue({
          id: 'user-1', email: 'a@b.com', name: 'Alice',
          passwordHash: '$2b$12$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        }),
      });
      const svc = new AuthService(factory as any);

      await expect(svc.login({ email: 'a@b.com', password: 'WrongPass1' }))
        .rejects.toMatchObject({ statusCode: 401 });
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes all tokens for the user', async () => {
      const factory = makeFactory();
      const svc = new AuthService(factory as any);

      await svc.logout('user-1');

      expect(factory._tokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });

  // ── refreshTokens ─────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    it('throws 401 when token is not in DB', async () => {
      const factory = makeFactory();
      const svc = new AuthService(factory as any);

      await expect(svc.refreshTokens('bad-token'))
        .rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws 401 when token is expired', async () => {
      const factory = makeFactory({}, {
        findByValue: vi.fn().mockResolvedValue({
          id: 't-1', type: 'refresh', expiresAt: new Date(Date.now() - 1000),
        }),
      });
      const svc = new AuthService(factory as any);

      await expect(svc.refreshTokens('expired'))
        .rejects.toMatchObject({ statusCode: 401 });
    });
  });



  // ── requestEmailVerification ──────────────────────────────────────────────

  // describe('requestEmailVerification', () => {
  //   it('issues OTP and sends email for existing user', async () => {
  //     const emailDriver = makeEmailDriver();
  //     const factory = makeFactory({
  //       findById: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com', name: 'Alice' }),
  //     });
  //     const svc = new AuthService(factory as any, createEmailService(emailDriver));

  //     await svc.requestEmailVerification('user-1');

  //     expect(factory._otpRepo.create).toHaveBeenCalledOnce();
  //     expect(emailDriver.calls[0]?.subject).toBe('Verify your email address');
  //   });

  //   it('throws 404 when user does not exist', async () => {
  //     const factory = makeFactory({ findById: vi.fn().mockResolvedValue(null) });
  //     const svc = new AuthService(factory as any);

  //     await expect(svc.requestEmailVerification('ghost'))
  //       .rejects.toMatchObject({ statusCode: 404 });
  //   });
  // });

  describe('requestPasswordReset', () => {
    it('enqueues a password_reset job when user exists', async () => {
      const factory = makeFactory({
        findByEmail: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com', name: 'Alice' }),
      });
      const svc = new AuthService(factory as any);

      await svc.requestPasswordReset({ email: 'a@b.com' });

      expect(mockEnqueue).toHaveBeenCalledWith(
        'password_reset',
        'a@b.com',
        expect.objectContaining({ code: expect.any(String) }),
      );
    });

    it('returns silently when user does not exist (prevents enumeration)', async () => {
      const factory = makeFactory({ findByEmail: vi.fn().mockResolvedValue(null) });
      const svc = new AuthService(factory as any);

      await expect(svc.requestPasswordReset({ email: 'unknown@x.com' })).resolves.toBeUndefined();
      expect(mockEnqueue).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('updates password and revokes all tokens on valid OTP', async () => {
      const validOtp = {
        id: 'otp-1', userId: 'user-1', code: '654321', purpose: 'password_reset',
        used: false, expiresAt: new Date(Date.now() + 60_000),
      };
      const factory = makeFactory(
        { findByEmail: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com' }) },
        {},
        { findValidOtp: vi.fn().mockResolvedValue(validOtp) },
      );
      const svc = new AuthService(factory as any);

      await svc.resetPassword({ email: 'a@b.com', code: '654321', newPassword: 'NewPass1!' });

      const updateArg = factory._userRepo.update.mock.calls[0][1];
      expect(updateArg.passwordHash).toMatch(/^\$2[ab]\$/);
      expect(factory._tokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('throws 400 when user not found', async () => {
      const factory = makeFactory({ findByEmail: vi.fn().mockResolvedValue(null) });
      const svc = new AuthService(factory as any);

      await expect(svc.resetPassword({ email: 'x@y.com', code: '000000', newPassword: 'Pass1!!' }))
        .rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('verifyEmail', () => {
    it('marks email verified on valid OTP', async () => {
      const validOtp = {
        id: 'otp-1', userId: 'user-1', code: '111111', purpose: 'email_verification',
        used: false, expiresAt: new Date(Date.now() + 60_000),
      };
      const factory = makeFactory(
        { findById: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com' }) },
        {},
        { findValidOtp: vi.fn().mockResolvedValue(validOtp) },
      );
      const svc = new AuthService(factory as any);

      await svc.verifyEmail({ userId: 'user-1', code: '111111' });

      expect(factory._userRepo.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ emailVerifiedAt: expect.any(Date) }),
      );
    });

    it('throws 404 when user not found', async () => {
      const factory = makeFactory({ findById: vi.fn().mockResolvedValue(null) });
      const svc = new AuthService(factory as any);

      await expect(svc.verifyEmail({ userId: 'ghost', code: '111111' }))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

});
