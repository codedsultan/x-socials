import type { Application } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import usersRoutes from '../modules/users/users.routes';
import postsRoutes from '../modules/posts/posts.routes';
import commentsRoutes from '../modules/comments/comments.routes';
import likesRoutes from '../modules/likes/likes.routes';
import feedRoutes          from '../modules/feed/feed.routes';
import notificationRoutes  from '../modules/notifications/notifications.routes';
import Logger from '../logger';

/**
 * ModuleRouter
 *
 * Single registration point for all feature module routers.
 * Mount order matters: more specific paths before catch-alls.
 *
 * Usage in ExpressApp:
 *   ModuleRouter.mount(this._app, 'api/v1');
 */
export class ModuleRouter {
  static mount(app: Application, prefix: string): void {
    const p = `/${prefix.replace(/^\/|\/$/g, '')}`;

    // ── Auth ──────────────────────────────────────────────────────────────────
    app.use(`${p}/auth`, authRoutes);

    // ── Users ─────────────────────────────────────────────────────────────────
    app.use(`${p}/users`, usersRoutes);

    // ── Posts ─────────────────────────────────────────────────────────────────
    app.use(`${p}/posts`, postsRoutes);

    // ── Comments (flat routes — nested /posts/:postId/comments handled inside)
    app.use(`${p}`, commentsRoutes);

    // ── Likes ─────────────────────────────────────────────────────────────────
    app.use(`${p}/likes`, likesRoutes);

    // ── Feed ──────────────────────────────────────────────────────────────────
    app.use(`${p}/feed`, feedRoutes);

    // ── Notifications ─────────────────────────────────────────────────────────
    app.use(`${p}/notifications`, notificationRoutes);

    Logger.getInstance().info(`ModuleRouter :: Modules mounted at ${p}`);
    Logger.getInstance().info(`  POST   ${p}/auth/register`);
    Logger.getInstance().info(`  POST   ${p}/auth/login`);
    Logger.getInstance().info(`  POST   ${p}/auth/refresh`);
    Logger.getInstance().info(`  POST   ${p}/auth/logout`);
    Logger.getInstance().info(`  GET    ${p}/auth/me`);
    Logger.getInstance().info(`  GET    ${p}/users`);
    Logger.getInstance().info(`  GET    ${p}/users/me`);
    Logger.getInstance().info(`  PATCH  ${p}/users/me`);
    Logger.getInstance().info(`  GET    ${p}/users/:id`);
    Logger.getInstance().info(`  POST   ${p}/users/:id/follow`);
    Logger.getInstance().info(`  DELETE ${p}/users/:id/follow`);
    Logger.getInstance().info(`  GET    ${p}/users/:id/followers`);
    Logger.getInstance().info(`  GET    ${p}/users/:id/following`);
    Logger.getInstance().info(`  GET    ${p}/posts`);
    Logger.getInstance().info(`  POST   ${p}/posts`);
    Logger.getInstance().info(`  GET    ${p}/posts/:id`);
    Logger.getInstance().info(`  PATCH  ${p}/posts/:id`);
    Logger.getInstance().info(`  DELETE ${p}/posts/:id`);
    Logger.getInstance().info(`  GET    ${p}/posts/:postId/comments`);
    Logger.getInstance().info(`  POST   ${p}/posts/:postId/comments`);
    Logger.getInstance().info(`  GET    ${p}/comments/:id/replies`);
    Logger.getInstance().info(`  PATCH  ${p}/comments/:id`);
    Logger.getInstance().info(`  DELETE ${p}/comments/:id`);
    Logger.getInstance().info(`  POST   ${p}/likes`);
    Logger.getInstance().info(`  GET    ${p}/likes/count`);
    Logger.getInstance().info(`  GET    ${p}/feed`);
    Logger.getInstance().info(`  GET    ${p}/feed/users/:userId`);
  }
}

export default ModuleRouter;
