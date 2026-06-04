import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('emailQueue', () => {
  let mockQueueAdd: ReturnType<typeof vi.fn>;
  let mockQueueClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    mockQueueAdd   = vi.fn().mockResolvedValue({ id: 'job-1' });
    mockQueueClose = vi.fn().mockResolvedValue(undefined);

    // Use vi.doMock (not hoisted) so the mock applies to the next import() after resetModules
    vi.doMock('bullmq', () => ({
      Queue: function MockQueue(this: Record<string, unknown>) {
        this['add']   = mockQueueAdd;
        this['close'] = mockQueueClose;
      },
    }));

    delete process.env['EMAIL_QUEUE'];
    delete process.env['REDIS_HOST'];
    delete process.env['REDIS_PORT'];
    delete process.env['REDIS_PASSWORD'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['EMAIL_QUEUE'];
  });

  it('EMAIL_QUEUE_NAME equals "email"', async () => {
    const { EMAIL_QUEUE_NAME } = await import('../emailQueue');
    expect(EMAIL_QUEUE_NAME).toBe('email');
  });

  describe('getEmailQueue()', () => {
    it('creates and returns a Queue instance', async () => {
      const { getEmailQueue } = await import('../emailQueue');
      const q = getEmailQueue();
      expect(q).toBeDefined();
      expect(q.add).toBe(mockQueueAdd);
    });

    it('returns the same instance on repeated calls (singleton)', async () => {
      const { getEmailQueue } = await import('../emailQueue');
      const q1 = getEmailQueue();
      const q2 = getEmailQueue();
      expect(q1).toBe(q2);
    });

    it('reads Redis host/port/password from env vars', async () => {
      process.env['REDIS_HOST']     = 'redis.prod.host';
      process.env['REDIS_PORT']     = '6380';
      process.env['REDIS_PASSWORD'] = 'topsecret';

      // Capture constructor args via a spy on the factory
      let capturedOpts: Record<string, unknown> | undefined;
      vi.doMock('bullmq', () => ({
        Queue: function MockQueue(this: Record<string, unknown>, _name: string, opts: Record<string, unknown>) {
          capturedOpts = opts;
          this['add']   = mockQueueAdd;
          this['close'] = mockQueueClose;
        },
      }));
      vi.resetModules();

      const { getEmailQueue } = await import('../emailQueue');
      getEmailQueue();

      expect(capturedOpts!['connection']).toMatchObject({
        host:     'redis.prod.host',
        port:     6380,
        password: 'topsecret',
      });
    });

    it('defaults to localhost:6379 when env vars are absent', async () => {
      let capturedOpts: Record<string, unknown> | undefined;
      vi.doMock('bullmq', () => ({
        Queue: function MockQueue(this: Record<string, unknown>, _name: string, opts: Record<string, unknown>) {
          capturedOpts = opts;
          this['add']   = mockQueueAdd;
          this['close'] = mockQueueClose;
        },
      }));
      vi.resetModules();

      const { getEmailQueue } = await import('../emailQueue');
      getEmailQueue();

      expect(capturedOpts!['connection']).toMatchObject({ host: 'localhost', port: 6379 });
    });

    it('configures retry options on defaultJobOptions', async () => {
      let capturedOpts: Record<string, unknown> | undefined;
      vi.doMock('bullmq', () => ({
        Queue: function MockQueue(this: Record<string, unknown>, _name: string, opts: Record<string, unknown>) {
          capturedOpts = opts;
          this['add']   = mockQueueAdd;
          this['close'] = mockQueueClose;
        },
      }));
      vi.resetModules();

      const { getEmailQueue } = await import('../emailQueue');
      getEmailQueue();

      const jobOpts = capturedOpts!['defaultJobOptions'] as Record<string, unknown>;
      expect(jobOpts['attempts']).toBe(3);
      expect(jobOpts['backoff']).toMatchObject({ type: 'exponential' });
    });
  });

  describe('enqueueEmail()', () => {
    it('adds a typed job to the queue when EMAIL_QUEUE=true', async () => {
      process.env['EMAIL_QUEUE'] = 'true';
      const { getEmailQueue, enqueueEmail } = await import('../emailQueue');
      getEmailQueue();

      await enqueueEmail('login_otp', 'u@x.com', { code: '111222', expiryMinutes: 5 });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'login_otp',
        expect.objectContaining({ type: 'login_otp', to: 'u@x.com' })
      );
    });

    it('does not call queue.add when EMAIL_QUEUE is not "true"', async () => {
      const mockSendTemplate = vi.fn().mockResolvedValue(undefined);
      vi.doMock('../../services/email/EmailService', () => ({
        getEmailService: () => ({ sendTemplate: mockSendTemplate }),
      }));

      const { enqueueEmail } = await import('../emailQueue');
      await enqueueEmail('login_otp', 'u@x.com', { code: '333', expiryMinutes: 10 });

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });
  });

  describe('closeEmailQueue()', () => {
    it('closes the queue when it has been initialized', async () => {
      const { getEmailQueue, closeEmailQueue } = await import('../emailQueue');
      getEmailQueue();

      await closeEmailQueue();

      expect(mockQueueClose).toHaveBeenCalled();
    });

    it('is a no-op when the queue was never initialized', async () => {
      const { closeEmailQueue } = await import('../emailQueue');

      await expect(closeEmailQueue()).resolves.toBeUndefined();
      expect(mockQueueClose).not.toHaveBeenCalled();
    });

    it('allows a fresh Queue instance to be created after close', async () => {
      let callCount = 0;
      vi.doMock('bullmq', () => ({
        Queue: function MockQueue(this: Record<string, unknown>) {
          callCount++;
          this['add']   = mockQueueAdd;
          this['close'] = mockQueueClose;
        },
      }));
      vi.resetModules();

      const { getEmailQueue, closeEmailQueue } = await import('../emailQueue');
      const first = getEmailQueue();
      await closeEmailQueue();
      const second = getEmailQueue();

      expect(callCount).toBe(2);
      expect(first).not.toBe(second);
    });
  });
});
