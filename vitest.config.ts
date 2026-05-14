import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: [],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/',
                'dist/',
                'coverage/',
                '**/*.config.ts',
                '**/__tests__/**',
                'src/index.ts',
                'src/interfaces/**',
                '**/*.test.ts',
                '**/*.spec.ts',
            ],
            thresholds: {
                statements: 65,
                branches: 56,
                functions: 68,
                lines: 66,
            },
        },
        include: ['src/**/*.{test,spec}.ts'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        testTimeout: 10000,
        hookTimeout: 10000,
        // Ensure tests run sequentially for env tests
        sequence: {
            concurrent: false,
        },
    },
});