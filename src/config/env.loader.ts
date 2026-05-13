export class EnvLoader {
    public static getString(key: string, defaultValue?: string): string | undefined {
        const value = process.env[key];
        if (!value && defaultValue !== undefined) return defaultValue;
        return value;
    }

    public static getNumber(key: string, defaultValue?: number): number | undefined {
        const value = process.env[key];
        if (!value && defaultValue !== undefined) return defaultValue;
        if (!value) return undefined;

        const parsed = parseInt(value, 10);
        if (isNaN(parsed) && defaultValue !== undefined) return defaultValue;
        if (isNaN(parsed)) return undefined;

        return parsed;
    }

    public static getBoolean(key: string, defaultValue?: boolean): boolean | undefined {
        const value = process.env[key];
        if (!value && defaultValue !== undefined) return defaultValue;
        if (!value) return undefined;

        return value === 'true';
    }

    public static getRequiredString(key: string): string {
        const value = process.env[key];
        if (!value) {
            throw new Error(`Required environment variable ${key} is missing`);
        }
        return value;
    }

    public static getRequiredNumber(key: string): number {
        const value = process.env[key];
        if (!value) {
            throw new Error(`Required environment variable ${key} is missing`);
        }

        const parsed = parseInt(value, 10);
        if (isNaN(parsed)) {
            throw new Error(`Required environment variable ${key} must be a number`);
        }

        return parsed;
    }
}