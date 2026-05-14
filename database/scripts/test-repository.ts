// scripts/test-repository.ts
import { ConfigService } from '../../src/config/config.service';
import { DatabaseInitializer } from '../../src/database/initializer';

async function testRepository() {
    const dbConfig = ConfigService.getDatabaseConfig();
    const db = new DatabaseInitializer(dbConfig);

    await db.initialize();

    const container = db.getContainer();
    const userRepo = container.factory.getRepository('User');

    try {
        const users = await userRepo.findMany({});
        console.log('Users found:', users);
    } catch (error) {
        console.error('Error:', error);
    }

    await db.shutdown();
}

testRepository();