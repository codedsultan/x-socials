import { describe, it, expect, vi } from 'vitest';
import { NotificationRepository } from '../NotificationRepository';

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    recipientId: 'user-1',
    actorId: 'user-2',
    type: 'like_post' as const,
    referenceId: 'post-1',
    read: false,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeAdapter(overrides: Record<string, unknown> = {}) {
  return {
    findOne:  vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create:   vi.fn().mockResolvedValue(makeNotification()),
    update:   vi.fn().mockResolvedValue(null),
    delete:   vi.fn().mockResolvedValue(true),
    exists:   vi.fn().mockResolvedValue(false),
    count:    vi.fn().mockResolvedValue(0),
    connect: vi.fn(), disconnect: vi.fn(), isConnected: vi.fn(),
    migrate: vi.fn(), withTransaction: vi.fn(), getClient: vi.fn(),
    ...overrides,
  };
}

describe('NotificationRepository', () => {

  describe('notify()', () => {
    it('creates a notification when actor !== recipient', async () => {
      const adapter = makeAdapter();
      const repo = new NotificationRepository(adapter as any, 'Notification');

      const result = await repo.notify('user-1', 'user-2', 'like_post', 'post-1');

      expect(result).not.toBeNull();
      expect(adapter.create).toHaveBeenCalledWith(
        'Notification',
        expect.objectContaining({
          recipientId: 'user-1',
          actorId:     'user-2',
          type:        'like_post',
          referenceId: 'post-1',
          read:        false,
        })
      );
    });

    it('returns null without creating when actor === recipient (self-notification guard)', async () => {
      const adapter = makeAdapter();
      const repo = new NotificationRepository(adapter as any, 'Notification');

      const result = await repo.notify('user-1', 'user-1', 'follow');

      expect(result).toBeNull();
      expect(adapter.create).not.toHaveBeenCalled();
    });

    it('sets referenceId to null when omitted', async () => {
      const adapter = makeAdapter();
      const repo = new NotificationRepository(adapter as any, 'Notification');

      await repo.notify('user-1', 'user-2', 'follow');

      expect(adapter.create).toHaveBeenCalledWith(
        'Notification',
        expect.objectContaining({ referenceId: null })
      );
    });
  });

  describe('listForUser()', () => {
    it('fetches notifications for a recipient with limit', async () => {
      const rows = [makeNotification(), makeNotification({ id: 'notif-2' })];
      const adapter = makeAdapter({ findMany: vi.fn().mockResolvedValue(rows) });
      const repo = new NotificationRepository(adapter as any, 'Notification');

      const result = await repo.listForUser('user-1', { limit: 10 });

      expect(result).toHaveLength(2);
      expect(adapter.findMany).toHaveBeenCalledWith(
        'Notification',
        expect.objectContaining({ recipientId: 'user-1' }),
        expect.objectContaining({ limit: 10 })
      );
    });

    it('adds read=false filter when unreadOnly is true', async () => {
      const adapter = makeAdapter();
      const repo = new NotificationRepository(adapter as any, 'Notification');

      await repo.listForUser('user-1', { limit: 5, unreadOnly: true });

      expect(adapter.findMany).toHaveBeenCalledWith(
        'Notification',
        expect.objectContaining({ recipientId: 'user-1', read: false }),
        expect.any(Object)
      );
    });

    it('does not add read filter when unreadOnly is false', async () => {
      const adapter = makeAdapter();
      const repo = new NotificationRepository(adapter as any, 'Notification');

      await repo.listForUser('user-1', { limit: 5, unreadOnly: false });

      const filterArg = adapter.findMany.mock.calls[0][1] as Record<string, unknown>;
      expect(filterArg).not.toHaveProperty('read');
    });

    it('passes the after cursor through', async () => {
      const adapter = makeAdapter();
      const repo = new NotificationRepository(adapter as any, 'Notification');

      await repo.listForUser('user-1', { limit: 5, after: 'cursor-abc' });

      expect(adapter.findMany).toHaveBeenCalledWith(
        'Notification',
        expect.any(Object),
        expect.objectContaining({ after: 'cursor-abc' })
      );
    });
  });

  describe('countUnread()', () => {
    it('delegates to adapter.count with recipientId and read=false', async () => {
      const adapter = makeAdapter({ count: vi.fn().mockResolvedValue(4) });
      const repo = new NotificationRepository(adapter as any, 'Notification');

      const count = await repo.countUnread('user-1');

      expect(count).toBe(4);
      expect(adapter.count).toHaveBeenCalledWith(
        'Notification',
        { recipientId: 'user-1', read: false }
      );
    });

    it('returns 0 when no unread notifications', async () => {
      const adapter = makeAdapter();
      const repo = new NotificationRepository(adapter as any, 'Notification');

      expect(await repo.countUnread('user-99')).toBe(0);
    });
  });

  describe('markRead()', () => {
    it('returns false when notification is not found', async () => {
      const adapter = makeAdapter({ findOne: vi.fn().mockResolvedValue(null) });
      const repo = new NotificationRepository(adapter as any, 'Notification');

      expect(await repo.markRead('notif-1', 'user-1')).toBe(false);
      expect(adapter.update).not.toHaveBeenCalled();
    });

    it('returns false when notification belongs to a different recipient', async () => {
      const adapter = makeAdapter({
        findOne: vi.fn().mockResolvedValue(makeNotification({ id: 'notif-1', recipientId: 'user-2' })),
      });
      const repo = new NotificationRepository(adapter as any, 'Notification');

      expect(await repo.markRead('notif-1', 'user-1')).toBe(false);
      expect(adapter.update).not.toHaveBeenCalled();
    });

    it('marks as read and returns true when caller owns the notification', async () => {
      const adapter = makeAdapter({
        findOne: vi.fn().mockResolvedValue(makeNotification({ id: 'notif-1', recipientId: 'user-1' })),
      });
      const repo = new NotificationRepository(adapter as any, 'Notification');

      expect(await repo.markRead('notif-1', 'user-1')).toBe(true);
      expect(adapter.update).toHaveBeenCalledWith('Notification', 'notif-1', { read: true });
    });
  });

  describe('markAllRead()', () => {
    it('uses Mongo fallback when adapter has no getKnex', async () => {
      const unread = [
        makeNotification({ id: 'n1', read: false }),
        makeNotification({ id: 'n2', read: false }),
      ];
      const adapter = makeAdapter({ findMany: vi.fn().mockResolvedValue(unread) });
      const repo = new NotificationRepository(adapter as any, 'Notification');

      await repo.markAllRead('user-1');

      expect(adapter.findMany).toHaveBeenCalledWith(
        'Notification',
        { recipientId: 'user-1', read: false },
        undefined
      );
      expect(adapter.update).toHaveBeenCalledTimes(2);
      expect(adapter.update).toHaveBeenCalledWith('Notification', 'n1', { read: true });
      expect(adapter.update).toHaveBeenCalledWith('Notification', 'n2', { read: true });
    });

    it('uses Knex batch UPDATE and skips the Mongo fallback', async () => {
      const mockUpdate  = vi.fn().mockResolvedValue(undefined);
      const mockWhere   = vi.fn().mockReturnValue({ update: mockUpdate });
      const mockTable   = vi.fn().mockReturnValue({ where: mockWhere });
      const mockGetKnex = vi.fn().mockReturnValue(mockTable);
      const adapter = makeAdapter({ getKnex: mockGetKnex });
      const repo = new NotificationRepository(adapter as any, 'Notification');

      await repo.markAllRead('user-1');

      expect(mockGetKnex).toHaveBeenCalled();
      expect(mockTable).toHaveBeenCalledWith('notifications');
      expect(mockWhere).toHaveBeenCalledWith({ recipient_id: 'user-1', read: false });
      expect(mockUpdate).toHaveBeenCalledWith({ read: true });
      expect(adapter.findMany).not.toHaveBeenCalled();
    });
  });
});
