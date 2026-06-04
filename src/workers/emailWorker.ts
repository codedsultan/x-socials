/**
 * Email worker — runs as a separate process alongside the API server.
 *
 * Start with:   node dist/workers/emailWorker.js
 * Dev:          tsx src/workers/emailWorker.ts
 *
 * In docker-compose (app.yml), uncomment the `worker` service:
 *   worker:
 *     command: ["node", "dist/workers/emailWorker.js"]
 *     env_file: ".env"
 *     depends_on: ["app"]
 */

import 'dotenv/config';
import { Worker, type Job } from 'bullmq';
import { EMAIL_QUEUE_NAME, type EmailJobData } from '../queue/emailQueue';
import { getEmailService } from '../services/email/EmailService';
import Logger from '../logger';

const logger = Logger.getInstance();

// ─── Connection (same config as the queue) ────────────────────────────────────

const connection = {
  host: process.env['REDIS_HOST'] ?? 'localhost',
  port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  password: process.env['REDIS_PASSWORD'] ?? undefined,
};

// ─── Processor ────────────────────────────────────────────────────────────────

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { type, to, data } = job.data;

  logger.info(`[emailWorker] Processing job ${job.id} — type=${type} to=${to} attempt=${job.attemptsMade + 1}`);

  const emailService = getEmailService();
  await emailService.sendTemplate(type as any, to, data as any);

  logger.info(`[emailWorker] Job ${job.id} completed — type=${type} to=${to}`);
}

// ─── Worker ───────────────────────────────────────────────────────────────────

const worker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  processEmailJob,
  {
    connection,
    concurrency: 5,   // send up to 5 emails in parallel
  },
);

worker.on('completed', (job) => {
  logger.info(`[emailWorker] ✓ Job ${job.id} (${job.data.type}) delivered to ${job.data.to}`);
});

worker.on('failed', (job, err) => {
  const attempts = job?.attemptsMade ?? 0;
  const maxAttempts = job?.opts?.attempts ?? 3;
  const exhausted = attempts >= maxAttempts;

  logger.error(
    `[emailWorker] ✗ Job ${job?.id} (${job?.data.type}) failed` +
    ` — attempt ${attempts}/${maxAttempts}` +
    (exhausted ? ' — EXHAUSTED, no more retries' : ' — will retry') +
    ` — ${err.message}`,
  );
});

worker.on('error', (err) => {
  logger.error(`[emailWorker] Worker error: ${err.message}`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info(`[emailWorker] ${signal} received — shutting down gracefully`);
  await worker.close();
  logger.info('[emailWorker] Worker closed');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

logger.info(`[emailWorker] Started — listening on queue "${EMAIL_QUEUE_NAME}"`);
logger.info(`[emailWorker] Redis: ${connection.host}:${connection.port}`);
