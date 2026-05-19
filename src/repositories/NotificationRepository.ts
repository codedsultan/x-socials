import { BaseRepository } from './BaseRepository';
import type { IRepository } from '../interfaces/db/IRepository';
import { generateSqlId } from '../utils/uuid';

export type NotificationType =
    | 'like_post'
    | 'like_comment'
    | 'follow'
    | 'comment'
    | 'reply';

export interface Notification {
    id: string;
    recipientId: string;
    actorId: string;
    type: NotificationType;
    referenceId?: string | null;
    read: boolean;
    createdAt?: Date;
}

export class NotificationRepository extends BaseRepository<Notification>
    implements IRepository<Notification> {

    /**
     * Create a notification — skips if actor === recipient (no self-notifications).
     */
    async notify(
        recipientId: string,
        actorId: string,
        type: NotificationType,
        referenceId?: string
    ): Promise<Notification | null> {
        if (recipientId === actorId) return null;

        return this.create({
            id:          generateSqlId(),
            recipientId,
            actorId,
            type,
            referenceId: referenceId ?? null,
            read:        false,
        });
    }

    /**
     * Keyset-paginated notifications for a recipient, newest first.
     * Optionally filter to unread only.
     */
    async listForUser(
        recipientId: string,
        opts: { limit: number; after?: string; unreadOnly?: boolean }
    ): Promise<Notification[]> {
        const filter: Partial<Notification> = { recipientId };
        if (opts.unreadOnly) filter.read = false;

        return this.findMany(filter, {
            limit:       opts.limit,
            after:       opts.after,
            sort:        { id: -1 }, // UUID v7: newest first
        });
    }

    /** Count unread notifications for a user. */
    async countUnread(recipientId: string): Promise<number> {
        return this.count({ recipientId, read: false });
    }

    /** Mark a single notification as read. */
    async markRead(notificationId: string, recipientId: string): Promise<boolean> {
        const n = await this.findById(notificationId);
        if (!n || n.recipientId !== recipientId) return false;
        await this.update(notificationId, { read: true });
        return true;
    }

    /**
     * Mark all notifications for a user as read — uses a raw batch UPDATE
     * via the underlying Knex client to avoid N individual update calls.
     */
    async markAllRead(recipientId: string): Promise<void> {
        const knexAdapter = this.adapter as any;
        if (knexAdapter.getKnex) {
            await knexAdapter
                .getKnex()('notifications')
                .where({ recipient_id: recipientId, read: false })
                .update({ read: true });
            return;
        }
        // Mongo fallback
        const unread = await this.findMany({ recipientId, read: false });
        await Promise.all(unread.map(n => this.update(n.id, { read: true })));
    }
}
