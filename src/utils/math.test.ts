import { describe, it, expect } from 'vitest'; // or import from 'vitest/globals'

function add(a: number, b: number): number {
    return a + b;
}

function multiply(a: number, b: number): number {
    return a * b;
}

describe('Math Utils', () => {
    describe('add', () => {
        it('should add two positive numbers', () => {
            expect(add(2, 3)).toBe(5);
        });

        it('should handle negative numbers', () => {
            expect(add(-1, -2)).toBe(-3);
        });
    });

    describe('multiply', () => {
        it('should multiply two numbers', () => {
            expect(multiply(4, 5)).toBe(20);
        });
    });
});