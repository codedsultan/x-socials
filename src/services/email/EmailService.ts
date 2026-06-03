// src/services/email/EmailService.ts
import type { IEmailDriver, SendMailOptions } from './drivers/IEmailDriver';
import { SmtpDriver } from './drivers/SmtpDriver';
import { templates, type EmailType, type EmailDataMap } from './templates';

export { OTP_TTL_MINUTES } from './templates/partials/otp-block.partial';
export type { EmailType };

/**
 * Thin facade — callers never touch the driver or templates directly.
 *
 * Usage:
 *   await emailService.sendTemplate('password_reset', 'user@x.com', {
 *     code: '123456',
 *     expiryMinutes: 10,
 *     userName: 'Alice',
 *   });
 *
 * Adding a new email type: see src/services/email/templates/index.ts
 */
export class EmailService {
  constructor(private readonly driver: IEmailDriver) {}

  /** Low-level send — use sendTemplate() for typed transactional emails */
  async send(options: SendMailOptions): Promise<void> {
    await this.driver.send(options);
  }

  /**
   * Send a typed transactional email.
   * TypeScript enforces that `data` matches the template's expected shape.
   */
  async sendTemplate<T extends EmailType>(
    type: T,
    to: string,
    data: EmailDataMap[T],
  ): Promise<void> {
    const template = templates[type] as any;
    await this.driver.send({
      to,
      subject: template.subject,
      html:    template.html(data),
      text:    template.text(data),
    });
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _instance: EmailService | null = null;

export function getEmailService(): EmailService {
  if (!_instance) {
    _instance = new EmailService(new SmtpDriver());
  }
  return _instance;
}

/** For tests — inject a mock driver without touching the singleton */
export function createEmailService(driver: IEmailDriver): EmailService {
  return new EmailService(driver);
}

/** For tests — reset the singleton between test suites */
export function resetEmailService(): void {
  _instance = null;
}
