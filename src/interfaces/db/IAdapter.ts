export interface IDatabaseAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;

    // Generic CRUD operations
    findOne(model: string, filter: Record<string, any>): Promise<any>;
    findMany(model: string, filter: Record<string, any>, options?: any): Promise<any[]>;
    create(model: string, data: Record<string, any>): Promise<any>;
    update(model: string, id: string, data: Record<string, any>): Promise<any>;
    delete(model: string, id: string): Promise<boolean>;

    // Model management
    registerModel(name: string, schema: any): void;

    // Transactions (for SQL)
    withTransaction<T>(fn: (session: any) => Promise<T>): Promise<T>;
}