/**
 * @file src/config/db/model-bindings.ts
 * @description Central configuration for which database each model uses
 */

import DbManager from "./DbManager";

export class ModelBindings {
    static configure(): void {
        const dbManager = DbManager.getInstance();

        // ============================================
        // PostgreSQL Models (Transactional/Relational)
        // ============================================
        dbManager.bindModel({ modelName: "UserModel", connectionName: "postgres" });
        dbManager.bindModel({ modelName: "TokenModel", connectionName: "postgres" });
        dbManager.bindModel({ modelName: "OTPModel", connectionName: "postgres" });

        // ============================================
        // MongoDB Models (Content/Document-based)
        // ============================================
        dbManager.bindModel({ modelName: "PostModel", connectionName: "mongodb_content" });
        // dbManager.bindModel({ modelName: "CommentModel", connectionName: "mongodb_content" });
        // dbManager.bindModel({ modelName: "LikeModel", connectionName: "mongodb_content" });

        console.log("✅ Model bindings configured");
    }
}