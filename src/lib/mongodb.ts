import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'p-x1';

if (!MONGODB_URI) {
  console.warn('[MongoDB] Warning: MONGODB_URI is not defined in environment variables. Falling back to mock in-memory store.');
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

interface GlobalWithMongo {
  _mongoClientPromise?: Promise<MongoClient>;
}

const globalWithMongo = global as unknown as GlobalWithMongo;

if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
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
      
      async updateOne(filter: any, update: any) {
        // Simple update helper
        const item = await this.findOne(filter);
        if (item && update && update.$set) {
          Object.assign(item, update.$set);
        }
        return { matchedCount: item ? 1 : 0, modifiedCount: item ? 1 : 0, acknowledged: true };
      }
    };
  };

  return {
    collection,
    // Reset mock store helper for tests
    _reset() {
      mockStore = {};
    }
  };
}

/**
 * Logs performance and AI API cost metrics to MongoDB.
 * Uses Claude 3.5 Sonnet / OpenAI text-embedding-3-small standard rates
 * to calculate estimated transaction billing.
 */
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
