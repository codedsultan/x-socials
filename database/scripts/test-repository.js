"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/test-repository.ts
const config_service_1 = require("../../src/config/config.service");
const initializer_1 = require("../../src/database/initializer");
async function testRepository() {
    const dbConfig = config_service_1.ConfigService.getDatabaseConfig();
    const db = new initializer_1.DatabaseInitializer(dbConfig);
    await db.initialize();
    const container = db.getContainer();
    const userRepo = container.factory.getRepository('User');
    try {
        const users = await userRepo.findMany({});
        console.log('Users found:', users);
    }
    catch (error) {
        console.error('Error:', error);
    }
    await db.shutdown();
}
testRepository();
//# sourceMappingURL=test-repository.js.map