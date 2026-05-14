// src/utils/uuid.ts
import { v7 as uuidv7, validate as uuidValidate, version as uuidVersion } from 'uuid';

/**
 * Generate a UUID v7 (time-ordered, sortable)
 * Format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
 * Example: 018f3e5b-4c5a-73d8-a1b2-c3d4e5f6a7b8
 */
export function generateUid(): string {
    return uuidv7();
}

/**
 * Generate multiple UUID v7s at once
 */
export function generateUids(count: number): string[] {
    return Array.from({ length: count }, () => uuidv7());
}

/**
 * Validate if a string is a valid UUID (any version)
 */
export function isValidUid(id: string): boolean {
    return uuidValidate(id);
}

/**
 * Check if a string is specifically a UUID v7
 */
export function isUidV7(id: string): boolean {
    return uuidValidate(id) && uuidVersion(id) === 7;
}

/**
 * Extract timestamp from UUID v7 (first 48 bits)
 * Returns milliseconds since epoch
 */
export function getTimestampFromUid(id: string): Date | null {
    if (!isUidV7(id)) return null;

    // UUID v7 has timestamp in first 48 bits (12 hex chars)
    const timestampHex = id.substring(0, 12);
    const timestampMs = parseInt(timestampHex, 16);
    return new Date(timestampMs);
}

/**
 * Sort UUIDs (useful for v7 which are time-ordered)
 */
export function sortUids(uids: string[], ascending: boolean = true): string[] {
    return [...uids].sort((a, b) => {
        return ascending ? a.localeCompare(b) : b.localeCompare(a);
    });
}