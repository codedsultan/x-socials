import { describe, it, expect, vi } from 'vitest';
import { NotificationsService, NotificationDispatcher } from '../notifications.service';

function makeNotif(overrides = {}) {
  return {
    id: 'n-1', type: 'follow' as const,
    actorId: 'actor-1', referenceId: null,
    read: false, createdAt: new Date(),
    ...overrides,
  };
}

function makeNotifRepo(overrides: Record<string, any> = {}) {
  return {
    notify:      vi.fn().mockResolvedValue(undefined),
    listForUser: vi.fn().mockResolvedValue([makeNotif()]),
    countUnread: vi.fn().mockResolvedValue(3),
    markRead:    vi.fn().mockResolvedValue(true),
    markAllRead: vi.fn().mockResolvedValue(undefined),
    findMany:    vi.fn().mockResolvedValue([]),
    findById:    vi.fn().mockResolvedValue(null),
    findOne:     vi.fn().mockResolvedValue(null),
    create:      vi.fn().mockResolvedValue(makeNotif()),
    update:      vi.fn().mockResolvedValue(null),
    delete:      vi.fn().mockResolvedValue(true),
    exists:      vi.fn().mockResolvedValue(false),
    count:       vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function makeFactory(overrides: Record<string, any> = {}) {
  const notifRepo = makeNotifRepo(overrides);
  return {
    getRepository: vi.fn(() => notifRepo),
    _notifRepo: notifRepo,
  };
}

// ── NotificationsService ───────────────────────────────────────────────────────

describe('NotificationsService', () => {
  describe('list()', () => {
    it('returns keyset-paginated notifications for the user', async () => {
      const factory = makeFactory();
      const svc = new NotificationsService(factory as any);
      const result = await svc.list('user-1', { limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.type).toBe('follow');
      expect(result.meta).toBeDefined();
      expect(factory._notifRepo.listForUser).toHaveBeenCalledWith('user-1', expect.objectContaining({
        limit: 21,
      }));
    });

    it('passes unreadOnly filter to the repo', async () => {
      const factory = makeFactory();
      const svc = new NotificationsService(factory as any);
      await svc.list('user-1', { limit: 10, unreadOnly: true });

      expect(factory._notifRepo.listForUser).toHaveBeenCalledWith('user-1', expect.objectContaining({
        unreadOnly: true,
      }));
    });
  });

  describe('unreadCount()', () => {
    it('returns the unread count from the repo', async () => {
      const factory = makeFactory({ countUnread: vi.fn().mockResolvedValue(7) });
      const svc = new NotificationsService(factory as any);
      const count = await svc.unreadCount('user-1');

      expect(count).toBe(7);
      expect(factory._notifRepo.countUnread).toHaveBeenCalledWith('user-1');
    });
  });

  describe('markRead()', () => {
    it('returns true when notification is found and marked read', async () => {
      const factory = makeFactory({ markRead: vi.fn().mockResolvedValue(true) });
      const svc = new NotificationsService(factory as any);
      const result = await svc.markRead('user-1', 'n-1');

      expect(result).toBe(true);
      expect(factory._notifRepo.markRead).toHaveBeenCalledWith('n-1', 'user-1');
    });

    it('returns false when notification is not found or not owned', async () => {
      const factory = makeFactory({ markRead: vi.fn().mockResolvedValue(false) });
      const svc = new NotificationsService(factory as any);
      const result = await svc.markRead('user-1', 'n-other');

      expect(result).toBe(false);
    });
  });

  describe('markAllRead()', () => {
    it('delegates to the repo with the correct userId', async () => {
      const factory = makeFactory();
      const svc = new NotificationsService(factory as any);
      await svc.markAllRead('user-1');

      expect(factory._notifRepo.markAllRead).toHaveBeenCalledWith('user-1');
    });
  });
});

// ── NotificationDispatcher ─────────────────────────────────────────────────────

describe('NotificationDispatcher', () => {
  describe('onLikePost()', () => {
    it('notifies the post author with type like_post', async () => {
      const factory = makeFactory();
      const dispatcher = new NotificationDispatcher(factory as any);
      await dispatcher.onLikePost('actor-1', 'author-1', 'post-1');

      expect(factory._notifRepo.notify).toHaveBeenCalledWith('author-1', 'actor-1', 'like_post', 'post-1');
    });
  });

  describe('onLikeComment()', () => {
    it('notifies the comment author with type like_comment', async () => {
      const factory = makeFactory();
      const dispatcher = new NotificationDispatcher(factory as any);
      await dispatcher.onLikeComment('actor-1', 'author-1', 'comment-1');

      expect(factory._notifRepo.notify).toHaveBeenCalledWith('author-1', 'actor-1', 'like_comment', 'comment-1');
    });
  });

  describe('onFollow()', () => {
    it('notifies the followed user with type follow', async () => {
      const factory = makeFactory();
      const dispatcher = new NotificationDispatcher(factory as any);
      await dispatcher.onFollow('actor-1', 'target-1');

      expect(factory._notifRepo.notify).toHaveBeenCalledWith('target-1', 'actor-1', 'follow');
    });
  });

  describe('onComment()', () => {
    it('notifies the post author with type comment', async () => {
      const factory = makeFactory();
      const dispatcher = new NotificationDispatcher(factory as any);
      await dispatcher.onComment('actor-1', 'author-1', 'post-1');

      expect(factory._notifRepo.notify).toHaveBeenCalledWith('author-1', 'actor-1', 'comment', 'post-1');
    });
  });

  describe('onReply()', () => {
    it('notifies the parent comment author with type reply', async () => {
      const factory = makeFactory();
      const dispatcher = new NotificationDispatcher(factory as any);
      await dispatcher.onReply('actor-1', 'parent-author-1', 'comment-1');

      expect(factory._notifRepo.notify).toHaveBeenCalledWith('parent-author-1', 'actor-1', 'reply', 'comment-1');
    });
  });

  describe('onContentRemoved()', () => {
    it('notifies the content author using system as actor to bypass self-notification check', async () => {
      const factory = makeFactory();
      const dispatcher = new NotificationDispatcher(factory as any);
      await dispatcher.onContentRemoved('author-1', 'post-1');

      expect(factory._notifRepo.notify).toHaveBeenCalledWith('author-1', 'system', 'content_removed', 'post-1');
    });
  });
});
