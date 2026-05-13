export type DbType = 'mongodb' | 'postgres' | 'mysql' | 'sqlite';

export type DbMode = 'split' | 'single';

/** Branded string so raw strings can't be passed where a ModelName is expected */
export type ModelName = string & { readonly __brand: 'ModelName' };

/** Helper to create a ModelName without casting everywhere */
export function toModelName(s: string): ModelName {
    return s as ModelName;
}

export type ModelDbMapping = Record<string, DbType | 'default'>;
