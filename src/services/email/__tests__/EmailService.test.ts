import { describe, it, expect, vi } from 'vitest';
import { createEmailService } from '../EmailService';
import { OTP_TTL_MINUTES } from '../templates/partials/otp-block.partial';
import type { IEmailDriver, SendMailOptions } from '../drivers/IEmailDriver';

function makeDriver(): IEmailDriver & { calls: SendMailOptions[] } {
  const calls: SendMailOptions[] = [];
  return {
    calls,
    send: vi.fn(async (opts: SendMailOptions): Promise<void> => { calls.push(opts); }),
  };
}

describe('EmailService', () => {

  describe('send()', () => {
    it('delegates to the driver', async () => {
      const driver = makeDriver();
      const svc = createEmailService(driver);

      await svc.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' });

      expect(driver.send).toHaveBeenCalledOnce();
      expect(driver.calls[0]!.to).toBe('a@b.com');
    });

    it('re-throws driver errors', async () => {
      const driver: IEmailDriver = {
        send: vi.fn().mockRejectedValue(new Error('SMTP timeout')),
      };
      const svc = createEmailService(driver);

      await expect(svc.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' }))
        .rejects.toThrow('SMTP timeout');
    });
  });

  describe('sendTemplate()', () => {
    it.each([
      ['email_verification', 'Verify your email address'],
      ['password_reset', 'Reset your password'],
      ['login_otp', 'Your login code'],
    ] as const)('type=%s → correct subject', async (type, expectedSubject) => {
      const driver = makeDriver();
      const svc = createEmailService(driver);

      await svc.sendTemplate(type, 'user@example.com', { code: '123456', expiryMinutes: OTP_TTL_MINUTES });

      expect(driver.calls[0]!.to).toBe('user@example.com');
      expect(driver.calls[0]!.subject).toBe(expectedSubject);
    });

    it('html contains the OTP code', async () => {
      const driver = makeDriver();
      const svc = createEmailService(driver);

      await svc.sendTemplate('email_verification', 'u@x.com', { code: '987654', expiryMinutes: 10 });

      expect(driver.calls[0]!.html).toContain('987654');
    });

    it('html contains expiry minutes', async () => {
      const driver = makeDriver();
      const svc = createEmailService(driver);

      await svc.sendTemplate('password_reset', 'u@x.com', { code: '111111', expiryMinutes: 15 });

      expect(driver.calls[0]!.html).toContain('15');
      expect(driver.calls[0]!.text).toContain('15');
    });

    it('text fallback is populated', async () => {
      const driver = makeDriver();
      const svc = createEmailService(driver);

      await svc.sendTemplate('login_otp', 'u@x.com', { code: '222333', expiryMinutes: 10 });

      expect(driver.calls[0]!.text).toContain('222333');
    });

    it('includes userName in html when provided', async () => {
      const driver = makeDriver();
      const svc = createEmailService(driver);

      await svc.sendTemplate('email_verification', 'u@x.com', {
        code: '444555',
        expiryMinutes: 10,
        userName: 'Sultan',
      });

      expect(driver.calls[0]!.html).toContain('Sultan');
    });
  });
});
