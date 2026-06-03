// src/services/email/drivers/SmtpDriver.ts
import nodemailer, { type Transporter } from 'nodemailer';
import type { IEmailDriver, SendMailOptions } from './IEmailDriver';
import Logger from '../../../logger';

/**
 * SMTP driver — works with any standard SMTP relay.
 *
 * Brevo credentials:
 *   SMTP_HOST=smtp-relay.brevo.com
 *   SMTP_PORT=587
 *   SMTP_USER=your-brevo-login-email
 *   SMTP_KEY=your-brevo-smtp-key      ← Settings → SMTP & API → SMTP tab
 *   SMTP_FROM=noreply@yourdomain.com
 *
 * The transporter is lazily created on first use so that missing env vars
 * only fail at send-time (test start-up stays fast).
 */
export class SmtpDriver implements IEmailDriver {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const host = process.env['SMTP_HOST'];
    const port = parseInt(process.env['SMTP_PORT'] ?? '587', 10);
    const user = process.env['SMTP_USER'];
    const pass = process.env['SMTP_KEY'];

    if (!host || !user || !pass) {
      throw new Error(
        'SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_KEY environment variables.'
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    return this.transporter;
  }

  async send(options: SendMailOptions): Promise<void> {
    const from = options.from ?? process.env['SMTP_FROM'] ?? 'noreply@x-socials.com';
    const logger = Logger.getInstance();

    try {
      const info = await this.getTransporter().sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      logger.info(`Email sent to ${options.to}: messageId=${info.messageId}`);
    } catch (err) {
      logger.error(`Failed to send email to ${options.to}: ${(err as Error).message}`);
      throw err;
    }
  }
}
