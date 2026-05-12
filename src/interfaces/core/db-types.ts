export type DbType = 'mongodb' | 'postgres' | 'mysql' | 'sqlite';
// export type ModelName = string;
export type ModelName = string & { __brand: 'ModelName' };

export interface DbConfig {
    type: DbType;
    connectionString: string;
    database?: string;
}

// export interface ModelDbMapping {
//     [modelName: string]: DbType | 'default';
// }
export type ModelDbMapping = Record<string, DbType | 'default'>;

