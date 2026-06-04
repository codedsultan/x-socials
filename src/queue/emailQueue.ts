import { Queue } from 'bullmq';
import type { EmailType, EmailDataMap } from '../services/email/templates';

// ─── Job payload ──────────────────────────────────────────────────────────────

/**
 * The shape stored in Redis for every email job.
 * Using a discriminated union so the worker can reconstruct the typed call
 * to EmailService.sendTemplate() without losing type safety.
 */
export type EmailJobData = {
  [T in EmailType]: {
    type: T;
    to: string;
    data: EmailDataMap[T];
  };
}[EmailType];

// ─── Queue name ───────────────────────────────────────────────────────────────

export const EMAIL_QUEUE_NAME = 'email';

// ─── Singleton queue instance ─────────────────────────────────────────────────

let _queue: Queue<EmailJobData> | null = null;

function getRedisConnection() {
  return {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
    password: process.env['REDIS_PASSWORD'] ?? undefined,
  };
}

export function getEmailQueue(): Queue<EmailJobData> {
  if (!_queue) {
    _queue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 }, // 5s, 10s, 20s
        removeOnComplete: { count: 100 },   // keep last 100 successful jobs for inspection
        removeOnFail: { count: 500 },   // keep last 500 failed jobs for debugging
      },
    });
  }
  return _queue;
}

// ─── Typed enqueue helper ─────────────────────────────────────────────────────

/**
 * Add an email job to the queue.
 * TypeScript enforces that `data` matches the template's expected shape.
 *
 * Usage:
 *   await enqueueEmail('password_reset', 'user@x.com', { code, expiryMinutes });
 */
export async function enqueueEmail<T extends EmailType>(
  type: T,
  to: string,
  data: EmailDataMap[T],
): Promise<void> {
  if (process.env['EMAIL_QUEUE'] !== 'true') {
    // Local dev: send directly, fire-and-forget
    const { getEmailService } = await import('../services/email/EmailService');
    getEmailService().sendTemplate(type as any, to, data as any).catch((err) => {
      console.warn(`[enqueueEmail] Direct send failed: ${err.message}`);
    });
    return;
  }

  const payload = { type, to, data } as EmailJobData;
  await getEmailQueue().add(type, payload);
}
/** Gracefully close the queue connection — call on process shutdown */
export async function closeEmailQueue(): Promise<void> {
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
}
