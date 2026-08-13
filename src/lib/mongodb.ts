import { MongoClient } from 'mongodb';
import { 
  MongoClusterDocument, 
  MongoProblemDocument, 
  MongoSolutionDocument, 
  MongoReviewDocument, 
  CategoryWithCount,
  MongoUserDocument
} from './models/schema';
import staticCategories from './ai/static-categories';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB_TEST || "needboard-test";
const SIMILARITY_THRESHOLD = Number(process.env.NEXT_PUBLIC_SIMILARITY_THRESHOLD || 0.70);

if (process.env.NODE_ENV !== 'test' && !MONGODB_URI) {
  console.warn('⚠️ MONGODB_URI is missing. MongoDB fallback mode will activate.');
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

if (process.env.NODE_ENV === 'test' || !MONGODB_URI) {
  // Mock fallback logic
} else if (process.env.NODE_ENV === 'development') {
  // In development/test mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI || 'mongodb://localhost:27017/p-x1');
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(MONGODB_URI || 'mongodb://localhost:27017/p-x1');
  clientPromise = client.connect();
}

// Shared mock database instance so that fallback state is preserved across request cycles
let activeMockDb: any = null;
let isMongoLive = false;

export function isMongoDbLive(): boolean {
  // If we are in test mode or URI is completely missing, it's always emulated
  if (process.env.NODE_ENV === 'test' || !MONGODB_URI) {
    return false;
  }
  return isMongoLive;
}

/**
 * Retrieves the connected MongoDB Database instance.
 * Supports graceful self-healing fallback to in-memory if MONGODB_URI connection throws or times out.
 */
export async function getDb() {
  if (process.env.NODE_ENV === 'test' || !MONGODB_URI) {
    if (!activeMockDb) activeMockDb = createMockMongoDb();
    isMongoLive = false;
    return activeMockDb;
  }
  
  try {
    // Wait for the client to establish a secure connection (resolves with a timeout of 4s)
    const connectedClient = await Promise.race([
      clientPromise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timed out after 4 seconds.')), 4000)
      )
    ]);
    isMongoLive = true; // 🚀 Live connected successfully!
    return connectedClient.db(MONGODB_DB);
  } catch (error: any) {
    isMongoLive = false; // 🚀 Fallback occurred
    console.warn(`[MongoDB] Live connection failed (Error: ${error?.message || error}). Falling back to in-memory emulator.`);
    console.log("👉 Tip: If using MongoDB Atlas, make sure your current local IP address is whitelisted in the Atlas Network Security console!");
    
    if (!activeMockDb) activeMockDb = createMockMongoDb();
    return activeMockDb;
  }
}

// -------------------------------------------------------------
// 🛡️ MOCK MONGODB FOR TESTING & UNCONFIGURED LOCAL ENVIRONMENTS
// -------------------------------------------------------------
let mockStore: Record<string, any[]> = {};

function getCosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    mA += a[i] * a[i];
    mB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(mA) * Math.sqrt(mB);
  return magnitude ? dotProduct / magnitude : 0;
}

function createMockMongoDb(): any {
  const collection = (name: string) => {
    if (!mockStore[name]) {
      mockStore[name] = [];
    }

    return {
      async find(filter: any) {
        let list = mockStore[name];
        // Simple filter matching
        if (filter && typeof filter === 'object') {
          list = list.filter((item) => {
            return Object.entries(filter).every(([key, val]) => {
              if (val && typeof val === 'object' && '$eq' in val) {
                return item[key] === (val as any).$eq;
              }
              if (val && typeof val === 'object' && '$in' in val) {
                return (val as any).$in.includes(item[key]);
              }
              return item[key] === val;
            });
          });
        }
        return {
          async toArray() {
            return list;
          },
        };
      },

      async findOne(filter: any) {
        const list = await (await this.find(filter)).toArray();
        return list[0] || null;
      },

      async insertOne(doc: any) {
        const item = { _id: `mock_id_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`, ...doc };
        mockStore[name].push(item);
        return { insertedId: item._id, acknowledged: true };
      },

      async deleteOne(filter: any) {
        const lengthBefore = mockStore[name].length;
        if (filter && typeof filter === 'object') {
          mockStore[name] = mockStore[name].filter((item) => {
            return !Object.entries(filter).every(([key, val]) => item[key] === val);
          });
        }
        return { deletedCount: lengthBefore - mockStore[name].length, acknowledged: true };
      },

      async deleteMany(filter: any) {
        const lengthBefore = mockStore[name].length;
        if (filter && typeof filter === 'object') {
          mockStore[name] = mockStore[name].filter((item) => {
            return !Object.entries(filter).every(([key, val]) => {
              if (val && typeof val === 'object' && '$regex' in val) {
                return (val as any).$regex.test(item[key]);
              }
              return item[key] === val;
            });
          });
        } else {
          mockStore[name] = [];
        }
        return { deletedCount: lengthBefore - mockStore[name].length, acknowledged: true };
      },
      
      async updateOne(filter: any, update: any) {
        const item = await this.findOne(filter);
        if (item && update) {
          if (update.$set) {
            Object.assign(item, update.$set);
          }
          if (update.$inc) {
            Object.entries(update.$inc).forEach(([key, val]) => {
              item[key] = (item[key] || 0) + (val as number);
            });
          }
          if (update.$push) {
            Object.entries(update.$push).forEach(([key, val]) => {
              if (!item[key]) item[key] = [];
              item[key].push(val);
            });
          }
          if (update.$pull) {
            Object.entries(update.$pull).forEach(([key, val]) => {
              if (item[key]) {
                item[key] = item[key].filter((v: any) => v !== val);
              }
            });
          }
        }
        return { matchedCount: item ? 1 : 0, modifiedCount: item ? 1 : 0, acknowledged: true };
      },

      async countDocuments() {
        return mockStore[name].length;
      },

      async aggregate(pipeline: any[]) {
        let list = [...mockStore[name]];
        
        // Handle Vector Search stage in memory! 🚀
        const vectorStage = pipeline.find((stage) => stage.$vectorSearch);
        if (vectorStage) {
          const qVector = vectorStage.$vectorSearch.queryVector;
          const limit = vectorStage.$vectorSearch.limit || 5;
          const categoryFilter = vectorStage.$vectorSearch.filter?.category?.$eq;

          if (categoryFilter) {
            list = list.filter(item => item.category === categoryFilter);
          }

          const scored = list.map((doc) => {
            const score = getCosineSimilarity(qVector, doc.embedding || []);
            return { ...doc, score };
          });
          list = scored.sort((a, b) => b.score - a.score).slice(0, limit);
        }

        return {
          async toArray() {
            return list;
          }
        };
      }
    };
  };

  return {
    collection,
    _reset() {
      mockStore = {};
    }
  };
}

// -------------------------------------------------------------
// 📊 PERFORMANCE TELEMETRY LOGGER
// -------------------------------------------------------------
export async function logMetric(type: 'submission' | 'search' | 'me-too', text: string) {
  try {
    const db = await getDb();
    const charCount = text.length;
    const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    const tokensIn = Math.ceil(charCount / 4) + 1200; // Prompt template overhead
    const tokensOut = 300; // Typical classification JSON response size
    
    // Pricing based on Claude 3.5 Sonnet standard rates: $3/M input, $15/M output
    const classificationCost = (tokensIn * 0.000003) + (tokensOut * 0.000015);
    // Embedding pricing (text-embedding-3-small): $0.02/M tokens
    const embeddingCost = Math.ceil(charCount / 4) * 0.00000002;
    const totalCost = type === 'submission' ? (classificationCost + embeddingCost) : embeddingCost;

    await db.collection('metrics').insertOne({
      type,
      charCount,
      wordCount,
      estimatedTokensIn: tokensIn,
      estimatedTokensOut: tokensOut,
      estimatedCost: totalCost,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[MongoDB] Failed to log metric:', error);
  }
}

// =========================================================================
// 🚀 DUAL-LAYER VECTOR SEARCH & PORTED PINECONE WRAPPERS
// =========================================================================

// For temporary compatibility, we will export whether Pinecone is active as always true for our MongoDB queries
export function isPineconeLive() {
  return isMongoDbLive();
}

/**
 * Fetch all clusters, optionally filtered by category.
 */
export async function getClusters(category?: string): Promise<MongoClusterDocument[]> {
  try {
    const db = await getDb();
    const filter = category ? { category } : {};
    
    // 🚀 Exclude embedding vector arrays and user co-sign lists to save massive network payload!
    const clusters = await db.collection('clusters')
      .find(filter, { projection: { embedding: 0, userIds: 0 } })
      .toArray();
    
    // Lazy-load solutions and truncate extra variant strings to prevent unlimited text leaks!
    return clusters.map((cluster: any) => {
      delete cluster._id;
      cluster.solutions = []; // Initialized as empty array for safety
      
      // Preserve array length for the UI's phrasings count (e.g., "phrased in 45 ways"),
      // but replace any text beyond the first 5 with empty strings to save bandwidth! 🚀
      if (cluster.sampleVariants && cluster.sampleVariants.length > 5) {
        cluster.sampleVariants = [
          ...cluster.sampleVariants.slice(0, 5),
          ...new Array(cluster.sampleVariants.length - 5).fill("")
        ];
      }
      return cluster;
    });
  } catch (error) {
    console.error('[MongoDB] getClusters failed:', error);
    return [];
  }
}

/**
 * Fetch a single cluster by ID.
 */
export async function getClusterById(id: string): Promise<MongoClusterDocument | null> {
  try {
    const db = await getDb();
    
    // 🚀 Exclude embedding vector arrays on details page to save payload!
    const cluster = await db.collection('clusters').findOne({ id }, { projection: { embedding: 0 } });
    if (!cluster) return null;
    
    const joined = await joinMongoDataToClusters([cluster as any]);
    return joined[0];
  } catch (error) {
    console.error(`[MongoDB] getClusterById failed for ${id}:`, error);
    return null;
  }
}

/**
 * Perform a semantic Atlas Vector Search against cluster centroids.
 */
export async function searchClusters(queryEmbedding: number[], limit = 5): Promise<(MongoClusterDocument & { score?: number })[]> {
  try {
    const db = await getDb();
    let results: any[];

    if (isMongoDbLive()) {
      // 🚀 MongoDB Atlas Vector Search Pipeline with strict field projections!
      // This strictly returns ONLY the 5 fields rendered on search page cards, 
      // completely stripping unrendered fields (embedding, sampleVariants, userIds, solutions, timestamps).
      results = await db.collection('clusters').aggregate([
        {
          $vectorSearch: {
            index: process.env.VECTOR_INDEX,
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: limit
          }
        },
        {
          $project: {
            id: 1,
            canonicalText: 1,
            categoryLabel: 1,
            memberCount: 1,
            score: { $meta: "vectorSearchScore" } // 🚀 Retrieve similarity score!
          }
        }
      ]).toArray();
    } else {
      // 🛡️ In-memory Cosine Similarity fallback for local/offline dev!
      results = await db.collection('clusters').aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            limit: limit
          }
        }
      ]).toArray();
    }

    return results.filter((cluster: any) => cluster.score >= SIMILARITY_THRESHOLD)
      .map((cluster: any) => ({
        id: cluster.id,
        canonicalText: cluster.canonicalText,
        categoryLabel: cluster.categoryLabel,
        memberCount: Number(cluster.memberCount || 0),
        score: cluster.score,
        solutions: [],
      } as any));
  } catch (error) {
    console.error('[MongoDB] searchClusters failed:', error);
    return [];
  }
}

/**
 * Perform a semantic Atlas Vector Search against cluster centroids.
 */
export async function searchClustersForSubmit(queryEmbedding: number[], limit = 5): Promise<(MongoClusterDocument & { score?: number })[]> {
  try {
    const db = await getDb();
    let results: any[];

    if (isMongoDbLive()) {
      // 🚀 MongoDB Atlas Vector Search Pipeline with strict field projections!
      // This strictly returns ONLY the 5 fields rendered on search page cards, 
      // completely stripping unrendered fields (embedding, sampleVariants, userIds, solutions, timestamps).
      results = await db.collection('clusters').aggregate([
        {
          $vectorSearch: {
            index: process.env.VECTOR_INDEX,
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: limit
          }
        },
        {
          $project: {
            embedding: 0,
            score: { $meta: "vectorSearchScore" } // 🚀 Retrieve similarity score!
          }
        }
      ]).toArray();
    } else {
      // 🛡️ In-memory Cosine Similarity fallback for local/offline dev!
      results = await db.collection('clusters').aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            limit: limit
          }
        }
      ]).toArray();
    }

    // Sanitize and return search cards (NO SOLUTIONS joined - lazy loaded!)
    return results.filter((cluster: any) => cluster.score >= SIMILARITY_THRESHOLD)
                  .map((cluster: any) => {
      // For local fallback mode, map to only those 5 required fields
      return {
        ...cluster
      } as any;
    });
  } catch (error) {
    console.error('[MongoDB] searchClusters failed:', error);
    return [];
  }
}

/**
 * Find adjacent clusters in vector space.
 */
export async function getAdjacentClusters(clusterId: string, limit = 4): Promise<MongoClusterDocument[]> {
  try {
    const db = await getDb();
    const target = await db.collection('clusters').findOne({ id: clusterId });
    if (!target || !target.embedding) return [];

    let results: any[];
    if (isMongoDbLive()) {
      // 🚀 Fetch limit + 1 results with strict field projections.
      // We remove the id-filter from $vectorSearch to avoid needing "id" indexed as filter in Atlas,
      // and perform the self-exclusion cleanly in Javascript post-query!
      results = await db.collection('clusters').aggregate([
        {
          $vectorSearch: {
            index: process.env.VECTOR_INDEX, 
            path: "embedding",
            queryVector: target.embedding,
            numCandidates: 100,
            limit: limit + 1
          }
        },
        {
          $project: {
            id: 1,
            canonicalText: 1,
            categoryLabel: 1,
            memberCount: 1,
            sampleVariants: 1
          }
        }
      ]).toArray();
    } else {
      results = await db.collection('clusters').aggregate([
        {
          $vectorSearch: {
            index: process.env.VECTOR_INDEX,
            path: "embedding",
            queryVector: target.embedding,
            limit: limit + 1
          }
        }
      ]).toArray();
    }

    // Filter out the active cluster we are currently looking at!
    const filteredResults = results.filter((r: any) => r.id !== clusterId);
    const sliced = filteredResults.slice(0, limit);
    
    // Sanitize and return adjacent list cards (lazy load solutions!)
    return sliced.map((cluster: any) => {
      delete cluster._id;
      delete cluster.embedding;
      cluster.solutions = [];
      
      // Truncate extra variant text to save network bandwidth while keeping array length count accurate
      if (cluster.sampleVariants && cluster.sampleVariants.length > 5) {
        cluster.sampleVariants = [
          ...cluster.sampleVariants.slice(0, 5),
          ...new Array(cluster.sampleVariants.length - 5).fill("")
        ];
      }
      return cluster;
    });
  } catch (error) {
    console.error(`[MongoDB] getAdjacentClusters failed for ${clusterId}:`, error);
    return [];
  }
}

/**
 * Upsert a cluster document.
 */
export async function upsertCluster(cluster: MongoClusterDocument, embedding: number[]): Promise<void> {
  try {
    const db = await getDb();
    
    // Merge the vector array and compute variantCount automatically 🚀
    const clusterDoc = {
      ...cluster,
      variantCount: cluster.sampleVariants?.length || 0,
      embedding
    };
    delete (clusterDoc as any)._id; // Clean ID

    await db.collection('clusters').updateOne(
      { id: cluster.id },
      { $set: clusterDoc },
      { upsert: true }
    );
  } catch (error) {
    console.error(`[MongoDB] upsertCluster failed for ${cluster.id}:`, error);
  }
}

/**
 * Insert a raw problem.
 */
export async function insertProblem(problem: MongoProblemDocument, embedding: number[]): Promise<void> {
  try {
    const db = await getDb();
    const problemDoc = {
      ...problem,
      embedding
    };
    delete (problemDoc as any)._id;

    await db.collection('problems').updateOne(
      { id: problem.id },
      { $set: problemDoc },
      { upsert: true }
    );
  } catch (error) {
    console.error(`[MongoDB] insertProblem failed for ${problem.id}:`, error);
  }
}

/**
 * Fetch all raw problems by cluster ID.
 */
export async function getProblemsByClusterId(clusterId: string): Promise<MongoProblemDocument[]> {
  try {
    const db = await getDb();
    const problems = await db.collection('problems').find({ clusterId }).toArray();
    return problems as any[];
  } catch (error) {
    console.error(`[MongoDB] getProblemsByClusterId failed for ${clusterId}:`, error);
    return [];
  }
}

/**
 * Fetch a single problem by ID.
 */
export async function getProblemById(id: string): Promise<{ record: MongoProblemDocument; embedding: number[] } | null> {
  try {
    const db = await getDb();
    const problem = await db.collection('problems').findOne({ id });
    if (!problem) return null;
    return {
      record: problem as any,
      embedding: problem.embedding || []
    };
  } catch (error) {
    console.error(`[MongoDB] getProblemById failed for ${id}:`, error);
    return null;
  }
}

/**
 * Dynamically aggregate and compile categories and counts on-the-fly.
 */
export async function getCategories(): Promise<CategoryWithCount[]> {
  try {
    const db = await getDb();

    // 2. Fetch counts in parallel from MongoDB Collections! 🚀
    const [clusters, problems] = await Promise.all([
      db.collection('clusters').find({}).toArray(),
      db.collection('problems').find({}).toArray()
    ]);

    return staticCategories.map(cat => {
      const clusterCount = clusters.filter((c: any) => c.category === cat.id).length;
      const problemCount = problems.filter((p: any) => p.category === cat.id).length;

      return {
        ...cat,
        clusterCount,
        problemCount
      };
    });
  } catch (error) {
    console.error('[MongoDB] getCategories failed:', error);
    return [];
  }
}

/**
 * Completely purges all vector data collections in MongoDB for fresh start seeding.
 */
export async function wipePineconeIndex(): Promise<void> {
  try {
    const db = await getDb();
    console.log('[MongoDB] Flushing all vector and dynamic collections for clean seeding...');
    
    // Clear mock store if active
    if (activeMockDb) {
      mockStore = {};
    }

    // Drop collections cleanly
    await Promise.all([
      db.collection('clusters').deleteMany({}),
      db.collection('problems').deleteMany({}),
      db.collection('solutions').deleteMany({}),
      db.collection('reviews').deleteMany({})
    ]);

    console.log('[MongoDB] All collections purged successfully.');
  } catch (error) {
    console.error('[MongoDB] Failed to clear collections:', error);
  }
}

// -------------------------------------------------------------
// 🔗 DYNAMIC MONGODB DATA JOIN UTILITY
// -------------------------------------------------------------
async function joinMongoDataToClusters(clusters: any[]): Promise<any[]> {
  if (clusters.length === 0) return clusters;
  try {
    const db = await getDb();
    const clusterIds = clusters.map(c => c.id);
    
    // Fetch solutions for these cluster IDs in parallel
    const solutions = await db.collection('solutions')
      .find({ clusterId: { $in: clusterIds } })
      .toArray();

    // 🚀 Fetch corresponding builder profile details from the users collection in batch!
    const builderIds = Array.from(new Set(solutions.map((s: any) => s.builderId).filter(Boolean)));
    const builders = builderIds.length > 0 
      ? await db.collection('users').find({ userId: { $in: builderIds } }).toArray()
      : [];

    // Map builder details by userId for instant O(1) matching!
    const buildersById = builders.reduce((acc: Record<string, any>, u: any) => {
      acc[u.userId] = {
        customBio: u.customBio || '',
        githubUrl: u.githubUrl || '',
        websiteUrl: u.websiteUrl || ''
      };
      return acc;
    }, {} as Record<string, any>);

    // Group solutions by clusterId
    const solutionsByCluster = solutions.reduce((acc: Record<string, any[]>, sol: any) => {
      const cId = sol.clusterId;
      if (cId) {
        if (!acc[cId]) {
          acc[cId] = [];
        }
        
        const builderPerks = buildersById[sol.builderId] || { customBio: '', githubUrl: '', websiteUrl: '' };

        acc[cId].push({
          id: sol.id,
          name: sol.name,
          url: sol.url,
          description: sol.description,
          builderId: sol.builderId,
          builderName: sol.builderName,
          builderBio: builderPerks.customBio,      // 🚀 Inject customized bio!
          builderGithub: builderPerks.githubUrl,  // 🚀 Inject custom GitHub link!
          builderWebsite: builderPerks.websiteUrl, // 🚀 Inject custom portfolio!
          upvotes: Number(sol.upvotes || 0),
          votesUserIds: Array.isArray(sol.votesUserIds) ? sol.votesUserIds : [],
          downvotedUserIds: Array.isArray(sol.downvotedUserIds) ? sol.downvotedUserIds : [],
          createdAt: sol.createdAt || new Date().toISOString(),
          iconUrl: sol.iconUrl || '/placeholder-solution-icon.png'
        });
      }
      return acc;
    }, {} as Record<string, any[]>);

    for (const cluster of clusters) {
      cluster.solutions = solutionsByCluster[cluster.id] || [];
      // Hydrate pre-calculated variantCount dynamically if missing from old records
      cluster.variantCount = typeof cluster.variantCount === 'number' ? cluster.variantCount : (cluster.sampleVariants?.length || 0);
      // Clean up raw MongoDB Object IDs to prevent UI serialisation errors
      delete cluster._id;
    }
  } catch (error) {
    console.warn('[MongoDB] Failed to join solutions to clusters:', error);
    for (const cluster of clusters) {
      if (!cluster.solutions) cluster.solutions = [];
    }
  }
  return clusters;
}

// =========================================================================
// 👤 USER PROFILES & ROLE-PERKS OPERATIONS
// =========================================================================

/**
 * Upsert or update a user document.
 * Handles initial registration and profile updates for builders/founders.
 */
export async function upsertUser(user: MongoUserDocument): Promise<void> {
  try {
    const db = await getDb();
    const userDoc = { ...user };
    delete (userDoc as any)._id; // Clean primary ID

    await db.collection('users').updateOne(
      { userId: user.userId },
      { $set: userDoc },
      { upsert: true }
    );
    console.log(`[MongoDB] User profile upserted successfully: ${user.userId}`);
  } catch (error) {
    console.error(`[MongoDB] upsertUser failed for ${user.userId}:`, error);
  }
}

/**
 * Fetch a user document from the users collection by their Clerk User ID.
 */
export async function getUserByClerkId(userId: string): Promise<MongoUserDocument | null> {
  try {
    const db = await getDb();
    const user = await db.collection('users').findOne({ userId });
    if (!user) return null;
    
    delete (user as any)._id; // Un-nest mongo primary key
    return user as any;
  } catch (error) {
    console.error(`[MongoDB] getUserByClerkId failed for ${userId}:`, error);
    return null;
  }
}

/**
 * Automatic Promotion Loop: Elevates a user from 'reporter' to 'builder'
 * the exact millisecond they submit their first verified product solution.
 */
export async function promoteUserToBuilder(userId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.collection('users').updateOne(
      { userId, role: 'reporter' },
      { $set: { role: 'builder' } }
    );
    console.log(`[MongoDB] User promoted to Builder: ${userId}`);
  } catch (error) {
    console.error(`[MongoDB] promoteUserToBuilder failed for ${userId}:`, error);
  }
}