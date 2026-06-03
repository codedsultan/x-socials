/**
 * Template registry.
 *
 * To add a new email type:
 *   1. Create `your-type.template.ts` in this folder with a typed data interface
 *      and html(data) / text(data) / subject exports.
 *   2. Add it to the `templates` map below.
 *   3. Add the type key to `EmailType`.
 *   4. Add the data type to `EmailDataMap`.
 *
 * That's it — EmailService.sendTemplate() picks it up automatically.
 */

import { emailVerificationTemplate, type EmailVerificationData } from './email-verification.template';
import { passwordResetTemplate, type PasswordResetData } from './password-reset.template';
import { loginOtpTemplate, type LoginOtpData } from './login-otp.template';

// ─── Email type union ────────────────────────────────────────────────────────

export type EmailType =
  | 'email_verification'
  | 'password_reset'
  | 'login_otp';

// ─── Data map — EmailType → its typed data shape ──────────────────────────────

export interface EmailDataMap {
  email_verification: EmailVerificationData;
  password_reset: PasswordResetData;
  login_otp: LoginOtpData;
}

// ─── Template shape ───────────────────────────────────────────────────────────

export interface EmailTemplate<T> {
  subject: string;
  html(data: T): string;
  text(data: T): string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

// Cast is safe — each template's T matches its EmailDataMap entry.
export const templates: { [K in EmailType]: EmailTemplate<EmailDataMap[K]> } = {
  email_verification: emailVerificationTemplate,
  password_reset: passwordResetTemplate,
  login_otp: loginOtpTemplate,
};
