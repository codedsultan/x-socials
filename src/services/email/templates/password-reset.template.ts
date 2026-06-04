import { baseLayout } from './base.layout';
import { otpBlock } from './partials/otp-block.partial';

export interface PasswordResetData {
  code: string;
  expiryMinutes: number;
  userName?: string;
}

export const passwordResetTemplate = {
  subject: 'Reset your password',

  html(data: PasswordResetData): string {
    const greeting = data.userName ? `Hi ${data.userName},` : 'Hi there,';

    return baseLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111">Password reset</h2>
      <p style="margin:0 0 4px;font-size:15px;color:#555">${greeting}</p>
      <p style="margin:0;font-size:15px;color:#555">
        We received a request to reset your password. Use the code below to proceed.
      </p>
      ${otpBlock(data.code, data.expiryMinutes)}
      <p style="margin:16px 0 0;font-size:14px;color:#777;line-height:1.6">
        If you didn't request a password reset, no action is needed — your account is safe.
      </p>
    `);
  },

  text(data: PasswordResetData): string {
    return [
      'Password reset',
      '',
      `Your reset code is: ${data.code}`,
      '',
      `This code expires in ${data.expiryMinutes} minutes.`,
      '',
      "If you didn't request a password reset, you can safely ignore this email.",
    ].join('\n');
  },
};
