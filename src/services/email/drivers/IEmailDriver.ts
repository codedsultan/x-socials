// src/services/email/drivers/IEmailDriver.ts

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string; // overrides the default SMTP_FROM when needed
}

export interface IEmailDriver {
  send(options: SendMailOptions): Promise<void>;
}
