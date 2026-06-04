import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nodemailer from 'nodemailer';

vi.mock('nodemailer');
vi.mock('../../../../logger', () => ({
  default: {
    getInstance: vi.fn().mockReturnValue({ info: vi.fn(), error: vi.fn() }),
  },
}));

import { SmtpDriver } from '../SmtpDriver';

describe('SmtpDriver', () => {
  let sendMailMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMailMock = vi.fn().mockResolvedValue({ messageId: 'msg-001' });
    vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail: sendMailMock } as any);

    process.env['SMTP_HOST']      = 'smtp.test.com';
    process.env['SMTP_USER']      = 'user@test.com';
    process.env['SMTP_KEY']       = 'secret-key';
    process.env['SMTP_FROM']      = 'noreply@test.com';
    process.env['SMTP_FROM_NAME'] = 'Test App';
  });

  afterEach(() => {
    delete process.env['SMTP_HOST'];
    delete process.env['SMTP_USER'];
    delete process.env['SMTP_KEY'];
    delete process.env['SMTP_FROM'];
    delete process.env['SMTP_FROM_NAME'];
    vi.clearAllMocks();
  });

  it('sends mail via the nodemailer transporter', async () => {
    const driver = new SmtpDriver();
    await driver.send({ to: 'a@b.com', subject: 'Hello', html: '<p>Hi</p>' });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.com', subject: 'Hello', html: '<p>Hi</p>' })
    );
  });

  it('builds from field from SMTP_FROM_NAME and SMTP_FROM env vars', async () => {
    const driver = new SmtpDriver();
    await driver.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' });
    const { from } = sendMailMock.mock.calls[0][0] as { from: string };
    expect(from).toContain('Test App');
    expect(from).toContain('noreply@test.com');
  });

  it('uses options.from when explicitly provided, ignoring env defaults', async () => {
    const driver = new SmtpDriver();
    await driver.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>', from: 'custom@x.com' });
    expect(sendMailMock.mock.calls[0][0].from).toBe('custom@x.com');
  });

  it('falls back gracefully when SMTP_FROM_NAME is absent', async () => {
    delete process.env['SMTP_FROM_NAME'];
    const driver = new SmtpDriver();
    await driver.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' });
    const { from } = sendMailMock.mock.calls[0][0] as { from: string };
    expect(from).toContain('X Socials');
  });

  it('throws when SMTP_HOST is missing', async () => {
    delete process.env['SMTP_HOST'];
    const driver = new SmtpDriver();
    await expect(driver.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' }))
      .rejects.toThrow('SMTP is not configured');
  });

  it('throws when SMTP_USER is missing', async () => {
    delete process.env['SMTP_USER'];
    const driver = new SmtpDriver();
    await expect(driver.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' }))
      .rejects.toThrow('SMTP is not configured');
  });

  it('re-throws errors from the transporter', async () => {
    sendMailMock.mockRejectedValue(new Error('Connection refused'));
    const driver = new SmtpDriver();
    await expect(driver.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' }))
      .rejects.toThrow('Connection refused');
  });

  it('reuses the same transporter instance on subsequent calls', async () => {
    const driver = new SmtpDriver();
    await driver.send({ to: 'a@b.com', subject: 'Hi1', html: '<p>1</p>' });
    await driver.send({ to: 'b@c.com', subject: 'Hi2', html: '<p>2</p>' });
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
  });

  it('creates transporter with secure=true when port is 465', async () => {
    process.env['SMTP_PORT'] = '465';
    const driver = new SmtpDriver();
    await driver.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: true, port: 465 })
    );
    delete process.env['SMTP_PORT'];
  });

  it('creates transporter with secure=false for non-465 port', async () => {
    const driver = new SmtpDriver();
    await driver.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hi</p>' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: false })
    );
  });
});
