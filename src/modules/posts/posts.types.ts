import type { PagedResult } from '../../shared/helpers/paginate';

export interface CreatePostDto {
  title: string;
  content: string;
  tags?: string[];
}

export interface UpdatePostDto {
  title?: string;
  content?: string;
  tags?: string[];
}

export interface PostResponse {
  id: string;
  title: string;
  content: string;
  authorId: string;
  tags: string[];
  likesCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Offset — for search/filter by tag/author where total count is meaningful */
export type PostOffsetPage = PagedResult<PostResponse>;

/** Cursor — for timeline/feed where stable scroll matters more than total */
export type PostCursorPage = PagedResult<PostResponse>;
