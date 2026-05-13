import { describe, it, expect, beforeEach } from 'vitest';
import { DbRegistry } from '../../../database/core/DbRegistry';
import type { ModelDbMapping } from '../../../interfaces/core/db-types';

const mapping: ModelDbMapping = {
    User:    'postgres',
    Otp:     'postgres',
    Token:   'postgres',
    Post:    'mongodb',
    Comment: 'mongodb',
    Like:    'mongodb',
};

describe('DbRegistry', () => {
    let registry: DbRegistry;

    beforeEach(() => {
        registry = new DbRegistry(mapping, 'mongodb');
    });

    it('routes SQL models to postgres', () => {
        expect(registry.getDbForModel('User')).toBe('postgres');
        expect(registry.getDbForModel('Otp')).toBe('postgres');
        expect(registry.getDbForModel('Token')).toBe('postgres');
    });

    it('routes Mongo models to mongodb', () => {
        expect(registry.getDbForModel('Post')).toBe('mongodb');
        expect(registry.getDbForModel('Comment')).toBe('mongodb');
        expect(registry.getDbForModel('Like')).toBe('mongodb');
    });

    it('falls back to defaultDb for unknown models', () => {
        expect(registry.getDbForModel('UnknownModel')).toBe('mongodb');
    });

    it('resolves "default" entries to the defaultDb', () => {
        const r = new DbRegistry({ Foo: 'default' }, 'postgres');
        expect(r.getDbForModel('Foo')).toBe('postgres');
    });

    it('single mode overrides all model routing', () => {
        registry.enableSingleMode('sqlite');
        expect(registry.getDbForModel('User')).toBe('sqlite');
        expect(registry.getDbForModel('Post')).toBe('sqlite');
        expect(registry.getMode()).toBe('single');
    });

    it('disabling single mode restores split routing', () => {
        registry.enableSingleMode('sqlite');
        registry.disableSingleMode();
        expect(registry.getDbForModel('User')).toBe('postgres');
        expect(registry.getDbForModel('Post')).toBe('mongodb');
        expect(registry.getMode()).toBe('split');
    });

    it('getDefaultDb respects single mode', () => {
        registry.enableSingleMode('mysql');
        expect(registry.getDefaultDb()).toBe('mysql');
    });
});
