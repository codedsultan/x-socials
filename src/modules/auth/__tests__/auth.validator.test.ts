import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, refreshTokenSchema } from '../auth.validator';

describe('auth validators', () => {
  describe('registerSchema', () => {
    const valid = { name: 'Alice', email: 'alice@example.com', password: 'Password1' };

    it('accepts valid input', () => {
      expect(registerSchema.safeParse(valid).success).toBe(true);
    });

    it('lowercases the email', () => {
      const result = registerSchema.safeParse({ ...valid, email: 'Alice@EXAMPLE.COM' });
      expect(result.success && result.data.email).toBe('alice@example.com');
    });

    it('rejects short name', () => {
      expect(registerSchema.safeParse({ ...valid, name: 'A' }).success).toBe(false);
    });

    it('rejects invalid email', () => {
      expect(registerSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
    });

    it('rejects password with no uppercase', () => {
      expect(registerSchema.safeParse({ ...valid, password: 'password1' }).success).toBe(false);
    });

    it('rejects password with no digit', () => {
      expect(registerSchema.safeParse({ ...valid, password: 'Password' }).success).toBe(false);
    });

    it('rejects password shorter than 8 chars', () => {
      expect(registerSchema.safeParse({ ...valid, password: 'Pa1' }).success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts valid credentials', () => {
      expect(loginSchema.safeParse({ email: 'a@b.com', password: 'anything' }).success).toBe(true);
    });

    it('rejects missing password', () => {
      expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
    });

    it('rejects bad email', () => {
      expect(loginSchema.safeParse({ email: 'bad', password: 'pw' }).success).toBe(false);
    });
  });

  describe('refreshTokenSchema', () => {
    it('accepts a non-empty token', () => {
      expect(refreshTokenSchema.safeParse({ refreshToken: 'abc' }).success).toBe(true);
    });

    it('rejects empty string', () => {
      expect(refreshTokenSchema.safeParse({ refreshToken: '' }).success).toBe(false);
    });

    it('rejects missing field', () => {
      expect(refreshTokenSchema.safeParse({}).success).toBe(false);
    });
  });
});
