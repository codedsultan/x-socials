// src/factories/RepositoryFactory.ts
import { DbResolver } from '../database/core/DbResolver';
import { IRepository } from '../interfaces/db/IRepository';
import { ModelSchemas } from '../models/schemas';
import { BaseRepository } from '../repositories/BaseRepository';
import { PostRepository } from '../repositories/PostRepository';

export class RepositoryFactory {
    private static instance: RepositoryFactory;
    private repositories: Map<string, IRepository> = new Map();

    private constructor(private dbResolver: DbResolver) {
        this.registerModels();
    }

    static getInstance(dbResolver: DbResolver): RepositoryFactory {
        if (!RepositoryFactory.instance) {
            RepositoryFactory.instance = new RepositoryFactory(dbResolver);
        }
        return RepositoryFactory.instance;
    }

    private registerModels(): void {
        // Register each model with its appropriate adapter
        for (const [modelName, schema] of Object.entries(ModelSchemas)) {
            const adapter = this.dbResolver.getAdapterForModel(modelName);
            adapter.registerModel(modelName, schema);
        }
    }

    getRepository<T>(modelName: string): IRepository<T> {
        if (this.repositories.has(modelName)) {
            return this.repositories.get(modelName) as IRepository<T>;
        }

        const adapter = this.dbResolver.getAdapterForModel(modelName);

        // Use custom repository if exists, otherwise base repository
        let repository: IRepository;

        switch (modelName) {
            case 'Post':
                repository = new PostRepository(adapter, modelName);
                break;
            default:
                repository = new BaseRepository<T>(adapter, modelName);
        }

        this.repositories.set(modelName, repository);
        return repository as IRepository<T>;
    }
}

// src/repositories/BaseRepository.ts

// src/repositories/PostRepository.ts - Example with custom methods
