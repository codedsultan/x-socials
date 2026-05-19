import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Application } from 'express';
import Logger from '../logger';
import ConfigService from './config.service';

// ─── Shared schema components ──────────────────────────────────────────────────

const components = {
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Pass the accessToken from /auth/login or /auth/register',
    },
  },
  schemas: {
    // ── Primitives ──────────────────────────────────────────────────────────
    Error: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error:   { type: 'string', example: 'Human-readable error message' },
      },
    },
    PageMeta: {
      type: 'object',
      required: ['limit', 'hasMore'],
      properties: {
        limit:       { type: 'integer', example: 20 },
        hasMore:     { type: 'boolean', example: true },
        // offset fields
        page:        { type: 'integer', example: 1 },
        total:       { type: 'integer', example: 147 },
        totalPages:  { type: 'integer', example: 8 },
        // cursor / keyset fields
        nextCursor:  { type: 'string',  example: 'eyJpZCI6IjAxOWUyOWE4In0', nullable: true },
        prevCursor:  { type: 'string',  example: 'eyJpZCI6IjAxOWUyOWE3In0', nullable: true },
      },
    },
    // ── Auth ───────────────────────────────────────────────────────────────
    AuthTokens: {
      type: 'object',
      properties: {
        accessToken:  { type: 'string', example: 'eyJhbGciOiJIUzI1NiJ9...' },
        refreshToken: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
        expiresIn:    { type: 'integer', example: 604800, description: 'Access token TTL in seconds' },
      },
    },
    AuthResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string',  example: 'Logged in successfully' },
        data: {
          type: 'object',
          properties: {
            user:   { '$ref': '#/components/schemas/User' },
            tokens: { '$ref': '#/components/schemas/AuthTokens' },
          },
        },
      },
    },
    // ── User ───────────────────────────────────────────────────────────────
    User: {
      type: 'object',
      properties: {
        id:             { type: 'string', format: 'uuid',      example: '019e29a8-7b9f-7209-bf7c-9fa84a4f3a74' },
        name:           { type: 'string',                       example: 'Alice Admin' },
        email:          { type: 'string', format: 'email',     example: 'alice@example.com' },
        createdAt:      { type: 'string', format: 'date-time', example: '2024-01-15T10:00:00.000Z' },
        followerCount:  { type: 'integer', example: 3 },
        followingCount: { type: 'integer', example: 1 },
        isFollowedByMe: { type: 'boolean', example: false,
          description: 'Only populated when request is authenticated' },
      },
    },
    FollowStatus: {
      type: 'object',
      properties: {
        followerId:  { type: 'string', format: 'uuid' },
        followingId: { type: 'string', format: 'uuid' },
        following:   { type: 'boolean', example: true },
      },
    },
    // ── Post ───────────────────────────────────────────────────────────────
    Post: {
      type: 'object',
      properties: {
        id:         { type: 'string', example: '6849f2a1c3d4e5f6a7b8c9d0',
          description: 'MongoDB ObjectId' },
        title:      { type: 'string', example: 'API design principles I live by' },
        content:    { type: 'string', example: 'After years of building APIs...' },
        authorId:   { type: 'string', format: 'uuid', example: '019e29a8-7b9f-7209-bf7c-9fa84a4f3a74' },
        tags:       { type: 'array', items: { type: 'string' }, example: ['api', 'engineering'] },
        likesCount: { type: 'integer', example: 5 },
        createdAt:  { type: 'string', format: 'date-time' },
        updatedAt:  { type: 'string', format: 'date-time' },
      },
    },
    FeedItem: {
      allOf: [
        { '$ref': '#/components/schemas/Post' },
        {
          type: 'object',
          properties: {
            likedByMe: { type: 'boolean', example: true,
              description: 'Whether the authenticated viewer has liked this post' },
          },
        },
      ],
    },
    // ── Comment ────────────────────────────────────────────────────────────
    Comment: {
      type: 'object',
      properties: {
        id:        { type: 'string', example: '6849f2a1c3d4e5f6a7b8c901', description: 'MongoDB ObjectId' },
        postId:    { type: 'string', example: '6849f2a1c3d4e5f6a7b8c9d0' },
        authorId:  { type: 'string', format: 'uuid' },
        content:   { type: 'string', example: 'Great post, thanks for sharing!' },
        parentId:  { type: 'string', nullable: true, example: null,
          description: 'Set to the parent comment ID to create a reply' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    // ── Like ───────────────────────────────────────────────────────────────
    LikeResponse: {
      type: 'object',
      properties: {
        liked:      { type: 'boolean', example: true,   description: 'true = liked, false = unliked' },
        targetId:   { type: 'string',  example: '6849f2a1c3d4e5f6a7b8c9d0' },
        targetType: { type: 'string',  enum: ['post', 'comment'], example: 'post' },
      },
    },
    // ── Paged responses ────────────────────────────────────────────────────
    PagedUsers: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { '$ref': '#/components/schemas/User' } },
            meta:  { '$ref': '#/components/schemas/PageMeta' },
          },
        },
      },
    },
    PagedPosts: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { '$ref': '#/components/schemas/Post' } },
            meta:  { '$ref': '#/components/schemas/PageMeta' },
          },
        },
      },
    },
    PagedFeed: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { '$ref': '#/components/schemas/FeedItem' } },
            meta:  { '$ref': '#/components/schemas/PageMeta' },
          },
        },
      },
    },
    PagedComments: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { '$ref': '#/components/schemas/Comment' } },
            meta:  { '$ref': '#/components/schemas/PageMeta' },
          },
        },
      },
    },
  },
  parameters: {
    limitParam: {
      name: 'limit', in: 'query',
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      description: 'Items per page (max 100)',
    },
    pageParam: {
      name: 'page', in: 'query',
      schema: { type: 'integer', minimum: 1, default: 1 },
      description: 'Page number — offset mode only',
    },
    cursorParam: {
      name: 'cursor', in: 'query',
      schema: { type: 'string' },
      description: 'Opaque cursor from previous response `meta.nextCursor` — cursor mode only. Mutually exclusive with `page`.',
    },
    afterParam: {
      name: 'after', in: 'query',
      schema: { type: 'string' },
      description: 'Last item ID from previous page — keyset mode. Mutually exclusive with `before`.',
    },
    beforeParam: {
      name: 'before', in: 'query',
      schema: { type: 'string' },
      description: 'First item ID of current page — keyset reverse navigation. Mutually exclusive with `after`.',
    },
    idPath: {
      name: 'id', in: 'path', required: true,
      schema: { type: 'string' },
      description: 'Resource ID',
    },
  },
  responses: {
    Unauthorized: {
      description: 'No token, invalid token, or expired token',
      content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' },
        example: { success: false, error: 'No token provided' } } },
    },
    Forbidden: {
      description: 'Authenticated but not allowed to perform this action',
      content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' },
        example: { success: false, error: 'You can only edit your own posts' } } },
    },
    NotFound: {
      description: 'Resource not found',
      content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' },
        example: { success: false, error: 'Post not found' } } },
    },
    Conflict: {
      description: 'Duplicate resource',
      content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' },
        example: { success: false, error: 'You are already following this user' } } },
    },
    BadRequest: {
      description: 'Validation error',
      content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' },
        example: { success: false, error: 'password: Password must be at least 8 characters' } } },
    },
    TooManyRequests: {
      description: 'Rate limit exceeded',
      content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' },
        example: { success: false, error: 'Too many auth attempts, please try again later' } } },
    },
    NoContent: { description: 'Success — no body returned' },
  },
};

// ─── Paths ─────────────────────────────────────────────────────────────────────

const paths = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  '/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Create a new account',
      description: 'Rate limited: 10 requests per 15 minutes per IP.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object', required: ['name', 'email', 'password'],
          properties: {
            name:     { type: 'string', minLength: 2, maxLength: 80, example: 'Alice Admin' },
            email:    { type: 'string', format: 'email', example: 'alice@example.com' },
            password: { type: 'string', minLength: 8,
              description: 'Must contain at least one uppercase letter and one number',
              example: 'SeedPass123' },
          },
        } } },
      },
      responses: {
        201: { description: 'Account created',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/AuthResponse' } } } },
        400: { '$ref': '#/components/responses/BadRequest' },
        409: { '$ref': '#/components/responses/Conflict' },
        429: { '$ref': '#/components/responses/TooManyRequests' },
      },
    },
  },
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Login and receive tokens',
      description: 'Rate limited: 10 requests per 15 minutes per IP.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object', required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'alice@example.com' },
            password: { type: 'string', example: 'SeedPass123' },
          },
        } } },
      },
      responses: {
        200: { description: 'Login successful',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/AuthResponse' } } } },
        400: { '$ref': '#/components/responses/BadRequest' },
        401: { '$ref': '#/components/responses/Unauthorized' },
        429: { '$ref': '#/components/responses/TooManyRequests' },
      },
    },
  },
  '/auth/refresh': {
    post: {
      tags: ['Auth'],
      summary: 'Rotate refresh token',
      description: 'Old refresh token is revoked. The new pair should replace both stored tokens.',
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object', required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
          },
        } } },
      },
      responses: {
        200: { description: 'Tokens rotated',
          content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object', properties: {
                tokens: { '$ref': '#/components/schemas/AuthTokens' },
              } },
            },
          } } } },
        401: { '$ref': '#/components/responses/Unauthorized' },
      },
    },
  },
  '/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Logout — revoke all refresh tokens',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Logged out successfully' },
        401: { '$ref': '#/components/responses/Unauthorized' },
      },
    },
  },
  '/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Get the currently authenticated user',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Current user',
          content: { 'application/json': { schema: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object', properties: {
                user: { type: 'object', properties: {
                  id:    { type: 'string' },
                  email: { type: 'string' },
                } },
              } },
            },
          } } } },
        401: { '$ref': '#/components/responses/Unauthorized' },
      },
    },
  },

  // ── Users ──────────────────────────────────────────────────────────────────
  '/users': {
    get: {
      tags: ['Users'],
      summary: 'List all users',
      description: 'Offset-paginated. Returns `items` array and `meta` with total count.',
      parameters: [
        { '$ref': '#/components/parameters/pageParam' },
        { '$ref': '#/components/parameters/limitParam' },
      ],
      responses: {
        200: { description: 'Paginated user list',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/PagedUsers' } } } },
      },
    },
  },
  '/users/me': {
    get: {
      tags: ['Users'],
      summary: 'Get my profile',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Current user\'s full profile with follower counts',
          content: { 'application/json': { schema: {
            type: 'object', properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object', properties: {
                user: { '$ref': '#/components/schemas/User' },
              } },
            },
          } } } },
        401: { '$ref': '#/components/responses/Unauthorized' },
      },
    },
    patch: {
      tags: ['Users'],
      summary: 'Update my profile',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object',
          properties: { name: { type: 'string', minLength: 2, maxLength: 80 } },
        } } },
      },
      responses: {
        200: { description: 'Profile updated' },
        400: { '$ref': '#/components/responses/BadRequest' },
        401: { '$ref': '#/components/responses/Unauthorized' },
      },
    },
  },
  '/users/{id}': {
    get: {
      tags: ['Users'],
      summary: 'Get a user\'s public profile',
      description: 'When authenticated, `isFollowedByMe` is populated.',
      parameters: [
        { '$ref': '#/components/parameters/idPath' },
      ],
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'User profile',
          content: { 'application/json': { schema: {
            type: 'object', properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object', properties: {
                user: { '$ref': '#/components/schemas/User' },
              } },
            },
          } } } },
        404: { '$ref': '#/components/responses/NotFound' },
      },
    },
  },
  '/users/{id}/follow': {
    post: {
      tags: ['Users'],
      summary: 'Follow a user',
      security: [{ bearerAuth: [] }],
      parameters: [{ '$ref': '#/components/parameters/idPath' }],
      responses: {
        200: { description: 'Now following',
          content: { 'application/json': { schema: {
            type: 'object', properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Now following' },
              data: { '$ref': '#/components/schemas/FollowStatus' },
            },
          } } } },
        400: { '$ref': '#/components/responses/BadRequest' },
        401: { '$ref': '#/components/responses/Unauthorized' },
        404: { '$ref': '#/components/responses/NotFound' },
        409: { '$ref': '#/components/responses/Conflict' },
      },
    },
    delete: {
      tags: ['Users'],
      summary: 'Unfollow a user',
      security: [{ bearerAuth: [] }],
      parameters: [{ '$ref': '#/components/parameters/idPath' }],
      responses: {
        200: { description: 'Unfollowed' },
        401: { '$ref': '#/components/responses/Unauthorized' },
        404: { '$ref': '#/components/responses/NotFound' },
      },
    },
  },
  '/users/{id}/followers': {
    get: {
      tags: ['Users'],
      summary: 'List a user\'s followers',
      description: 'Keyset-paginated. Use `?after=<id>` for next page, `?before=<id>` to go back.',
      parameters: [
        { '$ref': '#/components/parameters/idPath' },
        { '$ref': '#/components/parameters/afterParam' },
        { '$ref': '#/components/parameters/beforeParam' },
        { '$ref': '#/components/parameters/limitParam' },
      ],
      responses: {
        200: { description: 'Paginated followers list',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/PagedUsers' } } } },
        404: { '$ref': '#/components/responses/NotFound' },
      },
    },
  },
  '/users/{id}/following': {
    get: {
      tags: ['Users'],
      summary: 'List users this person follows',
      description: 'Keyset-paginated. Use `?after=<id>` for next page, `?before=<id>` to go back.',
      parameters: [
        { '$ref': '#/components/parameters/idPath' },
        { '$ref': '#/components/parameters/afterParam' },
        { '$ref': '#/components/parameters/beforeParam' },
        { '$ref': '#/components/parameters/limitParam' },
      ],
      responses: {
        200: { description: 'Paginated following list',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/PagedUsers' } } } },
        404: { '$ref': '#/components/responses/NotFound' },
      },
    },
  },

  // ── Posts ──────────────────────────────────────────────────────────────────
  '/posts': {
    get: {
      tags: ['Posts'],
      summary: 'List posts',
      description: [
        '**Two pagination modes:**',
        '- **Offset** (default) — `?page=1&limit=20` — use when filtering by `tag` or `authorId`; returns `total` count.',
        '- **Cursor** (timeline) — `?cursor=<token>&limit=20` — stable infinite scroll; no total count.',
        '',
        'Providing `cursor` switches to cursor mode. Providing `tag` or `authorId` always uses offset mode.',
      ].join('\n'),
      parameters: [
        { '$ref': '#/components/parameters/limitParam' },
        { '$ref': '#/components/parameters/pageParam' },
        { '$ref': '#/components/parameters/cursorParam' },
        { name: 'tag',      in: 'query', schema: { type: 'string' }, description: 'Filter by tag — forces offset mode' },
        { name: 'authorId', in: 'query', schema: { type: 'string' }, description: 'Filter by author UUID — forces offset mode' },
      ],
      responses: {
        200: { description: 'Paginated post list',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/PagedPosts' } } } },
      },
    },
    post: {
      tags: ['Posts'],
      summary: 'Create a post',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object', required: ['title', 'content'],
          properties: {
            title:   { type: 'string', minLength: 3, maxLength: 200, example: 'My first post' },
            content: { type: 'string', minLength: 1, maxLength: 10000, example: 'Full post content here...' },
            tags:    { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 10,
              example: ['engineering', 'api'] },
          },
        } } },
      },
      responses: {
        201: { description: 'Post created',
          content: { 'application/json': { schema: {
            type: 'object', properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Post created' },
              data: { type: 'object', properties: { post: { '$ref': '#/components/schemas/Post' } } },
            },
          } } } },
        400: { '$ref': '#/components/responses/BadRequest' },
        401: { '$ref': '#/components/responses/Unauthorized' },
      },
    },
  },
  '/posts/{id}': {
    get: {
      tags: ['Posts'],
      summary: 'Get a post by ID',
      parameters: [{ '$ref': '#/components/parameters/idPath' }],
      responses: {
        200: { description: 'Post found',
          content: { 'application/json': { schema: {
            type: 'object', properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object', properties: { post: { '$ref': '#/components/schemas/Post' } } },
            },
          } } } },
        404: { '$ref': '#/components/responses/NotFound' },
      },
    },
    patch: {
      tags: ['Posts'],
      summary: 'Update a post (author only)',
      security: [{ bearerAuth: [] }],
      parameters: [{ '$ref': '#/components/parameters/idPath' }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object',
          properties: {
            title:   { type: 'string', minLength: 3, maxLength: 200 },
            content: { type: 'string', minLength: 1, maxLength: 10000 },
            tags:    { type: 'array', items: { type: 'string' }, maxItems: 10 },
          },
        } } },
      },
      responses: {
        200: { description: 'Post updated' },
        401: { '$ref': '#/components/responses/Unauthorized' },
        403: { '$ref': '#/components/responses/Forbidden' },
        404: { '$ref': '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Posts'],
      summary: 'Delete a post (author only)',
      security: [{ bearerAuth: [] }],
      parameters: [{ '$ref': '#/components/parameters/idPath' }],
      responses: {
        204: { '$ref': '#/components/responses/NoContent' },
        401: { '$ref': '#/components/responses/Unauthorized' },
        403: { '$ref': '#/components/responses/Forbidden' },
        404: { '$ref': '#/components/responses/NotFound' },
      },
    },
  },

  // ── Comments ───────────────────────────────────────────────────────────────
  '/posts/{postId}/comments': {
    get: {
      tags: ['Comments'],
      summary: 'List top-level comments on a post',
      description: 'Keyset-paginated, oldest first. Use `?after=<lastId>` to fetch the next page. Top-level only — replies are fetched separately via `/comments/:id/replies`.',
      parameters: [
        { name: 'postId', in: 'path', required: true, schema: { type: 'string' } },
        { '$ref': '#/components/parameters/afterParam' },
        { '$ref': '#/components/parameters/beforeParam' },
        { '$ref': '#/components/parameters/limitParam' },
      ],
      responses: {
        200: { description: 'Paginated comments',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/PagedComments' } } } },
        400: { '$ref': '#/components/responses/BadRequest' },
        404: { '$ref': '#/components/responses/NotFound' },
      },
    },
    post: {
      tags: ['Comments'],
      summary: 'Add a comment to a post',
      description: 'Include `parentId` to reply to an existing comment.',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'postId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object', required: ['content'],
          properties: {
            content:  { type: 'string', minLength: 1, maxLength: 2000, example: 'Great post!' },
            parentId: { type: 'string', nullable: true,
              description: 'ID of the parent comment — omit for top-level comments',
              example: null },
          },
        } } },
      },
      responses: {
        201: { description: 'Comment created' },
        400: { '$ref': '#/components/responses/BadRequest' },
        401: { '$ref': '#/components/responses/Unauthorized' },
        404: { '$ref': '#/components/responses/NotFound' },
      },
    },
  },
  '/comments/{id}/replies': {
    get: {
      tags: ['Comments'],
      summary: 'Get replies to a comment',
      description: 'Keyset-paginated, oldest first.',
      parameters: [
        { '$ref': '#/components/parameters/idPath' },
        { '$ref': '#/components/parameters/afterParam' },
        { '$ref': '#/components/parameters/beforeParam' },
        { '$ref': '#/components/parameters/limitParam' },
      ],
      responses: {
        200: { description: 'Paginated replies',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/PagedComments' } } } },
      },
    },
  },
  '/comments/{id}': {
    patch: {
      tags: ['Comments'],
      summary: 'Edit a comment (author only)',
      security: [{ bearerAuth: [] }],
      parameters: [{ '$ref': '#/components/parameters/idPath' }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object', required: ['content'],
          properties: { content: { type: 'string', minLength: 1, maxLength: 2000 } },
        } } },
      },
      responses: {
        200: { description: 'Comment updated' },
        401: { '$ref': '#/components/responses/Unauthorized' },
        403: { '$ref': '#/components/responses/Forbidden' },
        404: { '$ref': '#/components/responses/NotFound' },
      },
    },
    delete: {
      tags: ['Comments'],
      summary: 'Delete a comment (author only)',
      security: [{ bearerAuth: [] }],
      parameters: [{ '$ref': '#/components/parameters/idPath' }],
      responses: {
        204: { '$ref': '#/components/responses/NoContent' },
        401: { '$ref': '#/components/responses/Unauthorized' },
        403: { '$ref': '#/components/responses/Forbidden' },
        404: { '$ref': '#/components/responses/NotFound' },
      },
    },
  },

  // ── Likes ──────────────────────────────────────────────────────────────────
  '/likes': {
    post: {
      tags: ['Likes'],
      summary: 'Toggle like on a post or comment',
      description: 'Idempotent toggle — calling twice on the same target removes the like. The unique constraint `(userId, targetId, targetType)` is enforced at the database level.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object', required: ['targetId', 'targetType'],
          properties: {
            targetId:   { type: 'string', example: '6849f2a1c3d4e5f6a7b8c9d0' },
            targetType: { type: 'string', enum: ['post', 'comment'], example: 'post' },
          },
        } } },
      },
      responses: {
        200: { description: 'Liked or unliked',
          content: { 'application/json': { schema: {
            type: 'object', properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string', example: 'Liked' },
              data: { '$ref': '#/components/schemas/LikeResponse' },
            },
          } } } },
        400: { '$ref': '#/components/responses/BadRequest' },
        401: { '$ref': '#/components/responses/Unauthorized' },
      },
    },
  },
  '/likes/count': {
    get: {
      tags: ['Likes'],
      summary: 'Get the like count for a post or comment',
      parameters: [
        { name: 'targetId',   in: 'query', required: true, schema: { type: 'string' } },
        { name: 'targetType', in: 'query', required: true,
          schema: { type: 'string', enum: ['post', 'comment'] } },
      ],
      responses: {
        200: { description: 'Like count',
          content: { 'application/json': { schema: {
            type: 'object', properties: {
              success: { type: 'boolean', example: true },
              data: { type: 'object', properties: {
                count:      { type: 'integer', example: 12 },
                targetId:   { type: 'string' },
                targetType: { type: 'string', enum: ['post', 'comment'] },
              } },
            },
          } } } },
      },
    },
  },

  // ── Feed ───────────────────────────────────────────────────────────────────
  '/feed': {
    get: {
      tags: ['Feed'],
      summary: 'Home feed',
      description: [
        'Cursor-paginated, newest first.',
        '',
        '**Authenticated**: returns posts from users you follow. Falls back to global feed when you follow nobody (onboarding).',
        '',
        '**Unauthenticated**: global feed — all posts newest first.',
        '',
        '`likedByMe` is populated only when authenticated. Pass the `cursor` from `meta.nextCursor` to fetch the next page.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      parameters: [
        { '$ref': '#/components/parameters/cursorParam' },
        { '$ref': '#/components/parameters/limitParam' },
      ],
      responses: {
        200: { description: 'Paginated feed',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/PagedFeed' } } } },
      },
    },
  },
  '/feed/users/{userId}': {
    get: {
      tags: ['Feed'],
      summary: 'Posts by a specific user',
      description: 'Cursor-paginated, newest first. `likedByMe` populated when authenticated.',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
        { '$ref': '#/components/parameters/cursorParam' },
        { '$ref': '#/components/parameters/limitParam' },
      ],
      responses: {
        200: { description: 'User\'s posts',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/PagedFeed' } } } },
        404: { '$ref': '#/components/responses/NotFound' },
      },
    },
  },
};

// ─── Swagger class ─────────────────────────────────────────────────────────────

class SwaggerDocs {
  private static swaggerSpecs: object | null = null;

  private static getOptions() {
    const serverUrl = ConfigService.getApiUrl();
    const nodeEnv   = ConfigService.getNodeEnv();
    const isProduction = ConfigService.isProduction();

    const servers: { url: string; description: string }[] = [
      { url: serverUrl, description: `${nodeEnv.toUpperCase()} server` },
    ];

    if (!isProduction) {
      servers.unshift({
        url: `http://localhost:${ConfigService.getPort()}`,
        description: 'Local development server',
      });
    }

    return {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'x-socials API',
          version: '1.0.0',
          description: [
            '## x-socials — Social Media Platform API',
            '',
            '### Authentication',
            'All protected endpoints require a `Bearer <accessToken>` header.',
            'Obtain tokens from `POST /auth/login` or `POST /auth/register`.',
            '',
            '### Response envelope',
            'Every response uses a consistent shape:',
            '```json',
            '{ "success": true, "data": { ... }, "message": "optional" }',
            '{ "success": false, "error": "human-readable message" }',
            '```',
            '',
            '### Pagination',
            '| Strategy | Used by | Query params |',
            '|---|---|---|',
            '| Offset | Users list, post search | `?page=1&limit=20` |',
            '| Cursor | Feed, post timeline | `?cursor=<token>&limit=20` |',
            '| Keyset | Comments, followers | `?after=<id>&limit=20` |',
            '',
            '### Seed credentials',
            'Password for all seed users: **SeedPass123**',
            '- alice@example.com (followed by everyone)',
            '- bob@example.com · charlie@example.com · diana@example.com',
          ].join('\n'),
          contact: {
            name: 'Olusegun Ibraheem',
            url: 'https://codesultan.xurl.fyi',
            email: 'codesultan369@gmail.com',
          },
          license: { name: 'MIT', url: 'https://spdx.org/licenses/MIT.html' },
        },
        servers,
        tags: [
          { name: 'Auth',     description: 'Registration, login, token rotation' },
          { name: 'Users',    description: 'Profiles, follow / unfollow, follower lists' },
          { name: 'Posts',    description: 'Create, read, update, delete posts' },
          { name: 'Comments', description: 'Threaded comments and replies' },
          { name: 'Likes',    description: 'Toggle likes on posts and comments' },
          { name: 'Feed',     description: 'Personalised home feed and per-user timelines' },
        ],
        components,
        paths,
      },
      // No JSDoc sources — the spec is defined entirely above
      apis: [],
    };
  }

  private static getSwaggerSpecs() {
    if (!this.swaggerSpecs) {
      this.swaggerSpecs = swaggerJsdoc(this.getOptions());
    }
    return this.swaggerSpecs;
  }

  public static init(_express: Application): Application {
    const nodeEnv       = ConfigService.getNodeEnv();
    const enableSwagger = ConfigService.isSwaggerEnabled();

    if (enableSwagger) {
      const swaggerSpecs = this.getSwaggerSpecs();

      _express.use(
        '/api-docs',
        swaggerUi.serve,
        swaggerUi.setup(swaggerSpecs, {
          explorer: true,
          customCss: '.swagger-ui .topbar { display: none }',
          customSiteTitle: `x-socials API — ${nodeEnv.toUpperCase()}`,
          swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            tryItOutEnabled: ConfigService.isDevelopment(),
          },
        })
      );

      _express.get('/api-docs.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpecs);
      });

      Logger.getInstance().info(`Swagger :: Initialized at /api-docs (${nodeEnv} mode)`);
    } else {
      if (process.env['EXTERNAL_DOCS_URL']) {
        _express.get('/api-docs',      (_req, res) => res.redirect(process.env['EXTERNAL_DOCS_URL']!));
        _express.get('/api-docs.json', (_req, res) => res.redirect(`${process.env['EXTERNAL_DOCS_URL']!}/json`));
      } else {
        const disabled = (_req: any, res: any) =>
          res.status(404).json({ error: 'Swagger documentation is disabled', environment: nodeEnv });
        _express.get('/api-docs',      disabled);
        _express.get('/api-docs.json', disabled);
      }
      Logger.getInstance().info(`Swagger :: Disabled (${nodeEnv} mode)`);
    }

    return _express;
  }

  public static getSpecs(): object {
    return this.getSwaggerSpecs();
  }
}

export default SwaggerDocs;
