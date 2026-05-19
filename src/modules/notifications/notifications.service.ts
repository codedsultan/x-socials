import type { RepositoryFactory } from '../../factories/RepositoryFactory';
import type { NotificationRepository } from '../../repositories/NotificationRepository';
import { buildKeysetPage } from '../../shared/helpers/paginate';
import type { PagedResult } from '../../shared/helpers/paginate';
import type { NotificationResponse } from './notifications.types';

export class NotificationsService {
  private get notifRepo(): NotificationRepository {
    return this.repoFactory.getRepository<any>('Notification') as NotificationRepository;
  }

  constructor(private readonly repoFactory: RepositoryFactory) { }

  /** Keyset-paginated list for the authenticated user. */
  async list(
    userId: string,
    opts: { limit: number; after?: string; unreadOnly?: boolean }
  ): Promise<PagedResult<NotificationResponse>> {
    const raw = await this.notifRepo.listForUser(userId, {
      limit: opts.limit + 1,
      after: opts.after,
      unreadOnly: opts.unreadOnly,
    });

    return buildKeysetPage(raw as NotificationResponse[], opts.limit, 'id');
  }

  /** Count of unread notifications — used for badge display. */
  async unreadCount(userId: string): Promise<number> {
    return this.notifRepo.countUnread(userId);
  }

  /** Mark a single notification as read. Returns false if not found or not owned. */
  async markRead(userId: string, notificationId: string): Promise<boolean> {
    return this.notifRepo.markRead(notificationId, userId);
  }

  /** Mark all of a user's notifications as read. */
  async markAllRead(userId: string): Promise<void> {
    return this.notifRepo.markAllRead(userId);
  }
}

/**
 * NotificationDispatcher — called by other services to create notifications.
 * Kept separate from NotificationsService so consumers don't import the full
 * service; they just call dispatch methods.
 */
export class NotificationDispatcher {
  private get notifRepo(): NotificationRepository {
    return this.repoFactory.getRepository<any>('Notification') as NotificationRepository;
  }

  constructor(private readonly repoFactory: RepositoryFactory) { }

  async onLikePost(actorId: string, postAuthorId: string, postId: string) {
    await this.notifRepo.notify(postAuthorId, actorId, 'like_post', postId);
  }

  async onLikeComment(actorId: string, commentAuthorId: string, commentId: string) {
    await this.notifRepo.notify(commentAuthorId, actorId, 'like_comment', commentId);
  }

  async onFollow(actorId: string, targetUserId: string) {
    await this.notifRepo.notify(targetUserId, actorId, 'follow');
  }

  async onComment(actorId: string, postAuthorId: string, postId: string) {
    await this.notifRepo.notify(postAuthorId, actorId, 'comment', postId);
  }

  async onReply(actorId: string, parentCommentAuthorId: string, commentId: string) {
    await this.notifRepo.notify(parentCommentAuthorId, actorId, 'reply', commentId);
  }
}
