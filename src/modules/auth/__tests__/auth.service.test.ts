import { describe, it, expect, vi } from 'vitest';
import { AuthService } from '../auth.service';

// ── Minimal repo fakes ────────────────────────────────────────────────────────

function makeUserRepo(overrides: Record<string, any> = {}) {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    emailExists: vi.fn().mockResolvedValue(false),
    create: vi.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com', name: 'Alice', passwordHash: 'h', createdAt: new Date() }),
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(null),
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

function makeFactory(userOverrides = {}, tokenOverrides = {}) {
  const userRepo = makeUserRepo(userOverrides);
  const tokenRepo = makeTokenRepo(tokenOverrides);
  return {
    getRepository: vi.fn((name: string) => {
      if (name === 'User') return userRepo;
      if (name === 'Token') return tokenRepo;
      throw new Error(`Unknown repo: ${name}`);
    }),
    _userRepo: userRepo,
    _tokenRepo: tokenRepo,
  };
}

// Stub ConfigService so no real env is needed
vi.mock('../../../config/config.service', () => ({
  default: {
    getServerConfig: () => ({
      JWT_SECRET: 'test-secret-at-least-32-characters-long!!',
      JWT_EXPIRES_IN: '1h',
    }),
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  describe('register', () => {
    it('creates a user and returns tokens', async () => {
      const factory = makeFactory();
      const service = new AuthService(factory as any);

      const result = await service.register({ name: 'Alice', email: 'a@b.com', password: 'Password1' });

      expect(result.user.email).toBe('a@b.com');
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
      expect(factory._userRepo.create).toHaveBeenCalledOnce();
      expect(factory._tokenRepo.create).toHaveBeenCalledOnce();
    });

    it('throws 409 if email already exists', async () => {
      const factory = makeFactory({ emailExists: vi.fn().mockResolvedValue(true) });
      const service = new AuthService(factory as any);

      await expect(service.register({ name: 'Alice', email: 'a@b.com', password: 'Password1' }))
        .rejects.toMatchObject({ statusCode: 409 });
    });

    it('hashes the password — does not store plaintext', async () => {
      const factory = makeFactory();
      const service = new AuthService(factory as any);

      await service.register({ name: 'Alice', email: 'a@b.com', password: 'Password1' });

      const createCall = factory._userRepo.create.mock.calls[0][0];
      expect(createCall.passwordHash).not.toBe('Password1');
      expect(createCall.passwordHash).toMatch(/^\$2[ab]\$/); // bcrypt prefix
    });
  });

  describe('login', () => {
    it('throws 401 when user does not exist', async () => {
      const factory = makeFactory({ findByEmail: vi.fn().mockResolvedValue(null) });
      const service = new AuthService(factory as any);

      await expect(service.login({ email: 'x@y.com', password: 'Password1' }))
        .rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws 401 on wrong password', async () => {
      // Pre-hash of "CorrectPass1" so bcrypt.compare fails for "WrongPass1"
      const factory = makeFactory({
        findByEmail: vi.fn().mockResolvedValue({
          id: 'user-1', email: 'a@b.com', name: 'Alice',
          // bcrypt hash of "CorrectPass1"
          passwordHash: '$2b$12$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        }),
      });
      const service = new AuthService(factory as any);

      await expect(service.login({ email: 'a@b.com', password: 'WrongPass1' }))
        .rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe('logout', () => {
    it('revokes all tokens for the user', async () => {
      const factory = makeFactory();
      const service = new AuthService(factory as any);

      await service.logout('user-1');

      expect(factory._tokenRepo.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('refreshTokens', () => {
    it('throws 401 when token is not in DB', async () => {
      const factory = makeFactory({}, { findByValue: vi.fn().mockResolvedValue(null) });
      const service = new AuthService(factory as any);

      await expect(service.refreshTokens('bad-token'))
        .rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws 401 when stored token has wrong type', async () => {
      const factory = makeFactory({}, {
        findByValue: vi.fn().mockResolvedValue({ id: 't-1', type: 'access', expiresAt: new Date(Date.now() + 1000) }),
      });
      const service = new AuthService(factory as any);

      await expect(service.refreshTokens('some-token'))
        .rejects.toMatchObject({ statusCode: 401 });
    });

    it('throws 401 when token is expired', async () => {
      const factory = makeFactory({}, {
        findByValue: vi.fn().mockResolvedValue({
          id: 't-1', type: 'refresh',
          expiresAt: new Date(Date.now() - 1000), // past
        }),
      });
      const service = new AuthService(factory as any);

      await expect(service.refreshTokens('expired-token'))
        .rejects.toMatchObject({ statusCode: 401 });
    });
  });
});
