export interface CreateCommentDto {
  content: string;
  parentId?: string;
}

export interface UpdateCommentDto {
  content: string;
}

export interface CommentResponse {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  parentId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
