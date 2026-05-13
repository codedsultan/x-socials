import type { RepositoryFactory } from '../factories/RepositoryFactory';

declare global {
    namespace Express {
        interface Request {
            /**
             * The RepositoryFactory injected by the database middleware.
             * Always present after the database has been initialized.
             * Use req.repoFactory.getRepository('User') in route handlers.
             */
            repoFactory?: RepositoryFactory;
        }
    }
}

export {};
