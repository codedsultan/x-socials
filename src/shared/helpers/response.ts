import type { Response } from 'express';

export interface SuccessPayload<T = unknown> {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface ErrorPayload {
  success: false;
  error: string;
  statusCode?: number;
}

export interface PaginationMeta {
  total?: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { statusCode?: number; message?: string; meta?: PaginationMeta } = {}
): Response {
  const { statusCode = 200, message, meta } = options;
  const body: SuccessPayload<T> = { success: true, data };
  if (message) body.message = message;
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T, message?: string): Response {
  return sendSuccess(res, data, { statusCode: 201, message });
}

export function sendNoContent(res: Response): Response {
  return res.status(204).end();
}

export function sendError(res: Response, statusCode: number, message: string): Response {
  const body: ErrorPayload = { success: false, error: message };
  if (process.env['NODE_ENV'] !== 'production') {
    body.statusCode = statusCode;
  }
  return res.status(statusCode).json(body);
}
