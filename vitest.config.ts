import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/',
                'dist/',
                'coverage/',
                '**/*.config.ts',
                '**/__tests__/**',  // Exclude integration tests from coverage
                'src/index.ts'       // Entry point
            ],
            thresholds: {
                statements: 80,
                branches: 80,
                functions: 80,
                lines: 80
            }
        },
        include: ['src/**/*.{test,spec}.ts'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        testTimeout: 10000
    }
});