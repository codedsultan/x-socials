"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// scripts/test-mongodb.ts
const config_service_1 = require("../../src/config/config.service");
const initializer_1 = require("../../src/database/initializer");
async function testMongoDB() {
    console.log('Testing MongoDB connection and data...\n');
    const dbConfig = config_service_1.ConfigService.getDatabaseConfig();
    const db = new initializer_1.DatabaseInitializer(dbConfig);
    await db.initialize();
    const container = db.getContainer();
    const postRepo = container.factory.getRepository('Post');
    try {
        // Get all posts
        const posts = await postRepo.findMany({});
        console.log(`📝 Found ${posts.length} posts:`);
        if (posts.length === 0) {
            console.log('   No posts found. Run seeding first: pnpm db:seed');
        }
        else {
            posts.forEach((post, index) => {
                console.log(`\n${index + 1}. ${post.title}`);
                console.log(`   Author ID: ${post.authorId}`);
                console.log(`   Tags: ${post.tags?.join(', ') || 'none'}`);
                console.log(`   Likes: ${post.likesCount || 0}`);
                console.log(`   Content: ${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}`);
                console.log(`   Created: ${post.createdAt?.toISOString()}`);
            });
        }
        // Get a single post
        if (posts.length > 0) {
            const singlePost = await postRepo.findOne({ id: posts[0].id });
            if (singlePost) {
                console.log(`\n✅ Successfully fetched single post: ${singlePost.title}`);
                console.log(`   Full content: ${singlePost.content}`);
            }
        }
        // Get posts by author (if there are posts with authorId)
        if (posts.length > 0 && posts[0].authorId) {
            const authorPosts = await postRepo.findByAuthor(posts[0].authorId);
            console.log(`\n📝 Found ${authorPosts.length} posts by author ${posts[0].authorId}`);
        }
        // Get posts by tag
        if (posts.length > 0 && posts[0].tags && posts[0].tags.length > 0) {
            const tag = posts[0].tags[0];
            const taggedPosts = await postRepo.findByTag(tag);
            console.log(`\n🏷️  Found ${taggedPosts.length} posts with tag "${tag}"`);
        }
        // Create a test post
        console.log('\n📝 Creating a test post...');
        const newPost = await postRepo.create({
            title: 'Test Post from Script',
            content: 'This is a test post created by the test script. It should be automatically cleaned up.',
            authorId: 'test-user-123',
            tags: ['test', 'script', 'automation'],
            likesCount: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        console.log(`✅ Created test post with ID: ${newPost.id}`);
        console.log(`   Title: ${newPost.title}`);
        console.log(`   Tags: ${newPost.tags?.join(', ')}`);
        // Test incrementLikes
        console.log('\n👍 Testing like increment...');
        const likedPost = await postRepo.incrementLikes(newPost.id);
        if (likedPost) {
            console.log(`✅ Post likes incremented to: ${likedPost.likesCount}`);
        }
        // Update the test post
        console.log('\n✏️  Testing update...');
        const updatedPost = await postRepo.update(newPost.id, {
            title: 'Updated Test Post',
            content: 'This content has been updated by the test script.',
            tags: ['test', 'script', 'updated'],
            updatedAt: new Date()
        });
        if (updatedPost) {
            console.log(`✅ Post updated successfully`);
            console.log(`   New title: ${updatedPost.title}`);
            console.log(`   New tags: ${updatedPost.tags?.join(', ')}`);
        }
        // Clean up test post
        console.log('\n🧹 Cleaning up test post...');
        const deleted = await postRepo.delete(newPost.id);
        if (deleted) {
            console.log(`✅ Test post deleted successfully`);
        }
        // Verify deletion
        const verifyDeleted = await postRepo.findOne({ id: newPost.id });
        if (!verifyDeleted) {
            console.log(`✅ Verified: Test post no longer exists in database`);
        }
        // Test statistics
        const allPosts = await postRepo.findMany({});
        const totalLikes = allPosts.reduce((sum, post) => sum + (post.likesCount || 0), 0);
        console.log(`\n📊 Statistics:`);
        console.log(`   Total posts: ${allPosts.length}`);
        console.log(`   Total likes: ${totalLikes}`);
        console.log(`   Average likes per post: ${(totalLikes / allPosts.length).toFixed(1)}`);
    }
    catch (error) {
        console.error('❌ Error:', error);
        if (error instanceof Error) {
            console.error('   Message:', error.message);
            console.error('   Stack:', error.stack);
        }
    }
    await db.shutdown();
    console.log('\n✅ MongoDB test complete');
}
// Run the test
testMongoDB().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
//# sourceMappingURL=test-mongodb.js.map