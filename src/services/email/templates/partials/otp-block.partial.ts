// src/services/email/templates/partials/otp-block.partial.ts

/**
 * Reusable OTP code block — used by email-verification, password-reset,
 * and login-otp templates. Renders the large code box + expiry line.
 *
 * To change the OTP box style: edit this file only.
 */
export const OTP_TTL_MINUTES = 10;

export function otpBlock(code: string, expiryMinutes: number): string {
  return `
    <div style="
      font-size:40px;
      font-weight:700;
      letter-spacing:.25em;
      color:#111;
      text-align:center;
      padding:24px 0;
      margin:24px 0;
      background:#f4f4f5;
      border-radius:8px;
    ">${code}</div>
    <p style="margin:0;font-size:13px;color:#888;text-align:center">
      Expires in <strong>${expiryMinutes} minutes</strong>
    </p>`;
}
