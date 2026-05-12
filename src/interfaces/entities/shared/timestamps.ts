/**
 * @file src/interfaces/entities/shared/timestamps.ts
 * @description Shared timestamp interfaces
 */

export interface ITimestamps {
  created_at: Date;
  updated_at: Date;
}

export interface ITimestampsDocument {
  createdAt: Date;
  updatedAt: Date;
}
