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
