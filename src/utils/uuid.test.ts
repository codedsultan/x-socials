import { describe, it, expect } from 'vitest';
import {
  generateUid, generateUids, isValidUid, isUidV7,
  getTimestampFromUid, sortUids,
} from './uuid';

describe('uuid utilities', () => {
  describe('generateUid()', () => {
    it('returns a valid UUID v7', () => {
      const id = generateUid();
      expect(isUidV7(id)).toBe(true);
    });
  });

  describe('generateUids()', () => {
    it('returns the requested number of UUID v7s', () => {
      const ids = generateUids(5);
      expect(ids).toHaveLength(5);
      ids.forEach(id => expect(isUidV7(id)).toBe(true));
    });

    it('returns an empty array for count=0', () => {
      expect(generateUids(0)).toEqual([]);
    });
  });

  describe('isValidUid()', () => {
    it('returns true for a valid UUID', () => {
      expect(isValidUid(generateUid())).toBe(true);
    });

    it('returns false for a non-UUID string', () => {
      expect(isValidUid('not-a-uuid')).toBe(false);
    });
  });

  describe('getTimestampFromUid()', () => {
    it('extracts a Date close to now from a freshly generated UUID v7', () => {
      const before = Date.now();
      const id = generateUid();
      const after = Date.now();
      const ts = getTimestampFromUid(id)!;
      expect(ts).toBeInstanceOf(Date);
      expect(ts.getTime()).toBeGreaterThanOrEqual(before - 1);
      expect(ts.getTime()).toBeLessThanOrEqual(after + 1);
    });

    it('returns null for a non-v7 UUID', () => {
      expect(getTimestampFromUid('550e8400-e29b-41d4-a716-446655440000')).toBeNull();
    });
  });

  describe('sortUids()', () => {
    it('sorts UUIDs in ascending (chronological) order by default', () => {
      const ids = generateUids(3);
      const shuffled = [ids[2]!, ids[0]!, ids[1]!];
      const sorted = sortUids(shuffled);
      expect(sorted[0]).toBe(ids[0]);
      expect(sorted[2]).toBe(ids[2]);
    });

    it('sorts in descending order when ascending=false', () => {
      const ids = generateUids(3);
      const shuffled = [ids[1]!, ids[0]!, ids[2]!];
      const sorted = sortUids(shuffled, false);
      expect(sorted[0]).toBe(ids[2]);
    });
  });
});
