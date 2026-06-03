import { baseLayout } from './base.layout';
import { otpBlock } from './partials/otp-block.partial';

export interface LoginOtpData {
  code: string;
  expiryMinutes: number;
  userName?: string;
}

export const loginOtpTemplate = {
  subject: 'Your login code',

  html(data: LoginOtpData): string {
    const greeting = data.userName ? `Hi ${data.userName},` : 'Hi there,';

    return baseLayout(`
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111">Your login code</h2>
      <p style="margin:0 0 4px;font-size:15px;color:#555">${greeting}</p>
      <p style="margin:0;font-size:15px;color:#555">
        Use the code below to sign in to your account.
      </p>
      ${otpBlock(data.code, data.expiryMinutes)}
      <p style="margin:16px 0 0;font-size:14px;color:#777;line-height:1.6">
        If you did not try to sign in, please secure your account immediately.
      </p>
    `);
  },

  text(data: LoginOtpData): string {
    return [
      'Your login code',
      '',
      `Your code is: ${data.code}`,
      '',
      `This code expires in ${data.expiryMinutes} minutes.`,
    ].join('\n');
  },
};
