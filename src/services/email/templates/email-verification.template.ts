import { baseLayout } from './base.layout';
import { otpBlock } from './partials/otp-block.partial';

export interface EmailVerificationData {
  code: string;
  expiryMinutes: number;
  userName?: string;
}

export const emailVerificationTemplate = {
  subject: 'Verify your email address',

  html(data: EmailVerificationData): string {
    const greeting = data.userName ? `Hi ${data.userName},` : 'Hi there,';

    return baseLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111">Verify your email</h2>
      <p style="margin:0 0 4px;font-size:15px;color:#555">${greeting}</p>
      <p style="margin:0 0 0;font-size:15px;color:#555">
        Use the code below to verify your email address and activate your account.
      </p>
      ${otpBlock(data.code, data.expiryMinutes)}
      <p style="margin:16px 0 0;font-size:14px;color:#777;line-height:1.6">
        Once verified, you'll have full access to X Socials.
      </p>
    `);
  },

  text(data: EmailVerificationData): string {
    return [
      'Verify your email address',
      '',
      `Your verification code is: ${data.code}`,
      '',
      `This code expires in ${data.expiryMinutes} minutes.`,
    ].join('\n');
  },
};
