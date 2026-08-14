import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { resolve } from 'path';
import { embeddingService } from '@/lib/ai';

// Load environment variables (.env.test has highest priority, falling back to .env)
config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB_TEST || process.env.MONGODB_DB_PROD || "needboard-dev";

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is missing from environment variables.");
  process.exit(1);
}

const SEED_USERS = [
  {
    userId: 'user_e2e_test_id',
    email: 'e2e@needboard.space',
    name: 'E2E Tester',
    role: 'user' as const,
    createdAt: new Date().toISOString()
  },
  {
    userId: 'user_e2e_admin_id',
    email: 'admin@needboard.space',
    name: 'E2E Admin',
    role: 'admin' as const,
    createdAt: new Date().toISOString()
  }
];

const SEED_CLUSTERS = [
  {
    id: 'cluster-e2e-calendar-sync',
    category: 'software-saas',
    categoryLabel: 'SaaS & B2B Productivity',
    categoryDescription: 'Administrative bottlenecks, calendar coordination headaches, and collaborative document syncing issues.',
    canonicalText: 'No simple way to automatically sync real-time calendar availability across multiple independent external organizations',
    memberCount: 38,
    variantCount: 1,
    sampleVariants: [
      'I have a personal calendar, a work calendar, and a client calendar. Keeping them in sync manually is impossible.'
    ],
    userIds: ['some_other_user_id'], // Not user_e2e_test_id so the test user can "Me Too" support it!
    creatorId: 'some_other_user_id',
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    embedding: [0]

  },
  {
    id: 'cluster-e2e-flaky-tests',
    category: 'software-devtools',
    categoryLabel: 'Developer Tools & DX',
    categoryDescription: 'Friction in local developer workflows, compilation bottlenecks, flaky testing environments, and monorepo configurations.',
    canonicalText: 'Flaky local testing setups and slow hot-reload compilation times in microfrontend development',
    memberCount: 54,
    variantCount: 1,
    sampleVariants: [
      'Webpack hot-reloading fails completely when running module federation in watch mode on larger monorepos.'
    ],
    userIds: ['some_other_user_id'],
    creatorId: 'some_other_user_id',
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    embedding: [0]
  }
];



const SEED_PROBLEMS = [
  {
    id: 'prob-e2e-1',
    clusterId: 'cluster-e2e-calendar-sync',
    category: 'software-saas',
    rawText: 'I have a personal calendar, a work calendar, and a client calendar. Keeping them in sync manually is impossible.',
    userId: 'some_other_user_id',
    createdAt: new Date().toISOString(),
    embedding: [0]
  },
  {
    id: 'prob-e2e-2',
    clusterId: 'cluster-e2e-flaky-tests',
    category: 'software-devtools',
    rawText: 'Webpack hot-reloading fails completely when running module federation in watch mode on larger monorepos.',
    userId: 'some_other_user_id',
    createdAt: new Date().toISOString(),
    embedding: [0]
  }
];

const SEED_SOLUTIONS = [
  {
    id: 'sol-e2e-1',
    clusterId: 'cluster-e2e-calendar-sync',
    name: 'CrossSync Calendar Mock',
    url: 'https://crosssync.app',
    description: 'A mock calendar sync solution to verify upvotes and solutions.',
    builderId: 'user_e2e_test_id', // Owned by the test user so they can edit/delete it!
    builderName: 'E2E Tester',
    upvotes: 5,
    votesUserIds: ['user_e2e_admin_id', 'some_other_user_id'],
    downvotedUserIds: [],
    createdAt: new Date().toISOString()
  }
];

const SEED_REVIEWS = [
  {
    clusterId: 'cluster-e2e-calendar-sync',
    solutionId: 'sol-e2e-1',
    userId: 'user_e2e_admin_id',
    userName: 'E2E Admin',
    rating: 5,
    text: 'This is a fantastic mock product!',
    createdAt: new Date().toISOString()
  }
];

async function run() {
  console.log(`🌀 Connecting to MongoDB: ${MONGODB_DB}...`);
  const client = new MongoClient(MONGODB_URI as string);
  
  try {
    await client.connect();
    const db = client.db(MONGODB_DB);

    // Fixed dimensional embedding centroid mock (1536 elements of floats)

    const embeddings = [[0], [0]];
    for (let idx = 0; idx < SEED_CLUSTERS.length; idx++) {
      const item = SEED_CLUSTERS[idx];
      const e = await embeddingService.getEmbedding(item.canonicalText);
      console.log(e);
      embeddings[idx] = e;
      
      // Update item in place or return updated item if assigned to a variable
      SEED_CLUSTERS[idx] = {
        ...item,
        embedding: e
      };
    }

    const updated_SEED_PROBLEMS = SEED_PROBLEMS.map((item, idx) => {
      return {...item, embedding: embeddings[idx]}
    })

    console.log("🧹 Wiping E2E test database collections...");
    await db.collection('users').deleteMany({});
    await db.collection('clusters').deleteMany({});
    await db.collection('problems').deleteMany({});
    await db.collection('solutions').deleteMany({});
    await db.collection('reviews').deleteMany({});
    await db.collection('metrics').deleteMany({});


    console.log("🌱 Inserting E2E seed users...");
    await db.collection('users').insertMany(SEED_USERS);

    console.log("🌱 Inserting E2E seed clusters...");
    await db.collection('clusters').insertMany(SEED_CLUSTERS);

    console.log("🌱 Inserting E2E seed problems...");
    await db.collection('problems').insertMany(updated_SEED_PROBLEMS);

    console.log("🌱 Inserting E2E seed solutions...");
    await db.collection('solutions').insertMany(SEED_SOLUTIONS);

    console.log("🌱 Inserting E2E seed reviews...");
    await db.collection('reviews').insertMany(SEED_REVIEWS);

    console.log("✅ Database reset and seed COMPLETED successfully!");
  } catch (err) {
    console.error("❌ Database seeding failed:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the script directly if invoked
if (require.main === module) {
  run();
}

export { run as resetAndSeedDatabase };
