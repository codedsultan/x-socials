/**
 * ModerationWebhook
 *
 * Fire-and-forget webhook client that notifies the FastAPI moderation
 * service whenever a post or comment is created or updated.
 *
 * Design principles:
 *   - Never blocks the Node.js write path. The HTTP call is awaited with a
 *     hard 200 ms timeout. If FastAPI doesn't acknowledge within that window
 *     the call is abandoned and the content creation still succeeds.
 *   - Never throws. All errors are caught and logged. A moderation service
 *     outage must not degrade the social platform's availability.
 *   - Stateless. No retry queue, no persistence. The periodic reconciliation
 *     scan (running every 6 hours on the Laravel scheduler) catches any items
 *     that were missed because the webhook dropped.
 *
 * Configuration (.env on the Node.js service):
 *   MODERATOR_URL=http://localhost:8001   Base URL of the FastAPI service
 *   MODERATOR_API_KEY=                   Optional — matches FastAPI api_key setting
 *   MODERATOR_WEBHOOK_ENABLED=true       Set to false to disable in tests/CI
 *   MODERATOR_WEBHOOK_TIMEOUT_MS=200     Hard timeout (default 200 ms)
 */

import Logger from '../logger';

const logger = Logger.getInstance();

interface EnqueuePayload {
    id: string;
    content: string;
    authorId: string;
    content_type: 'post' | 'comment';
    post_id?: string;   // required when content_type='comment'
}

export class ModerationWebhook {
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly enabled: boolean;
    private readonly timeoutMs: number;

    constructor() {
        this.baseUrl = (process.env['MODERATOR_URL'] ?? 'http://localhost:8001').replace(/\/$/, '');
        this.apiKey = process.env['MODERATOR_API_KEY'] ?? '';
        this.enabled = process.env['MODERATOR_WEBHOOK_ENABLED'] !== 'false';
        this.timeoutMs = Number(process.env['MODERATOR_WEBHOOK_TIMEOUT_MS'] ?? 200);
    }

    /**
     * Enqueue a post for moderation analysis.
     * Called after successful post creation or update.
     */
    async enqueuePost(post: {
        id: string;
        title: string;
        content: string;
        authorId: string;
    }): Promise<void> {
        await this._send({
            id: post.id,
            // Mirror the text format ScanService uses so the AI sees consistent input
            content: `Title: ${post.title}\n\nBody:\n${post.content}`.trim(),
            authorId: post.authorId,
            content_type: 'post',
        });
    }

    /**
     * Enqueue a comment for moderation analysis.
     * Called after successful comment creation or update.
     */
    async enqueueComment(comment: {
        id: string;
        content: string;
        authorId: string;
        postId: string;
    }): Promise<void> {
        await this._send({
            id: comment.id,
            content: comment.content,
            authorId: comment.authorId,
            content_type: 'comment',
            post_id: comment.postId,
        });
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private async _send(payload: EnqueuePayload): Promise<void> {
        if (!this.enabled) return;

        const url = `${this.baseUrl}/moderate/enqueue`;

        try {
            // AbortController gives us the hard timeout without relying on
            // fetch's signal support being available in all Node 22 builds.
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);

            const res = await fetch(url, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey ? { 'X-Api-Key': this.apiKey } : {}),
                },
                body: JSON.stringify(payload),
            });

            clearTimeout(timer);

            if (!res.ok) {
                // Log non-2xx but don't throw — reconciliation scan will catch this
                logger.warn('ModerationWebhook: FastAPI returned non-2xx', {
                    status: res.status,
                    content_id: payload.id,
                    content_type: payload.content_type,

                });
            } else {
                logger.debug('ModerationWebhook: enqueued', {
                    content_id: payload.id,
                    content_type: payload.content_type,
                });
            }
        } catch (err: unknown) {
            // AbortError = timeout; any other error = FastAPI down / DNS failure
            const isTimeout = err instanceof Error && err.name === 'AbortError';
            logger.warn('ModerationWebhook: delivery failed (reconciliation scan will cover)', {
                reason: isTimeout ? 'timeout' : String(err),
                content_id: payload.id,
                content_type: payload.content_type,
                url: url,
                apiKey: this.apiKey

            });
        }
    }
}

// Singleton — instantiated once, shared across all requests
export const moderationWebhook = new ModerationWebhook();
