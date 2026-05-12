/**
 * @file src/repositories/index.ts
 * @description Repository factory - returns appropriate implementation based on config
 */

import DbManager from "../config/db/DbManager";
import { MongooseAdapter } from "../config/db/adapters/MongooseAdapter";
import { KnexAdapter } from "../config/db/adapters/KnexAdapter";
import type { IUserRepository } from "../interfaces/repositories/user.repository";
import { MongoUserRepository } from "./mongo/user.repository";
import { SQLUserRepository } from "./sql/user.repository";

export class RepositoryFactory {
    private static instance: RepositoryFactory;
    private userRepository: IUserRepository | null = null;

    static getInstance(): RepositoryFactory {
        if (!RepositoryFactory.instance) {
            RepositoryFactory.instance = new RepositoryFactory();
        }
        return RepositoryFactory.instance;
    }

    getUserRepository(): IUserRepository {
        if (!this.userRepository) {
            // Resolve which adapter UserModel is bound to using DbResolver
            const adapter = DbManager.getInstance().resolveForModel("UserModel");

            if (!adapter) {
                throw new Error(
                    "UserModel is not bound to any connection. " +
                    "Call DbManager.getInstance().bindModel() before using the repository."
                );
            }

            // Check adapter type to determine which repository to use
            if (adapter instanceof MongooseAdapter) {
                console.log("Using MongoDB repository for UserModel");
                this.userRepository = new MongoUserRepository();
            } else if (adapter instanceof KnexAdapter) {
                console.log("Using SQL/PostgreSQL repository for UserModel");
                this.userRepository = new SQLUserRepository();
            } else {
                throw new Error(`Unknown adapter type for UserModel: ${adapter.constructor.name}`);
            }
        }
        return this.userRepository;
    }
}

// Export a function to get the user repository instance
export const userRepository = () => RepositoryFactory.getInstance().getUserRepository();

//  Export a direct singleton instance 
// export const userRepositoryInstance = userRepository();