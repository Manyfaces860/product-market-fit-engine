import { Pinecone } from '@pinecone-database/pinecone';

export interface Solution {
  id: string;
  name: string;
  url: string;
  description: string;
  builderId: string;
  builderName: string;
  upvotes: number;
  votesUserIds: string[];
  createdAt: string;
  iconUrl?: string;
}

export interface ClusterRecord {
  id: string;
  category: string;
  categoryLabel: string;
  categoryDescription: string;
  canonicalText: string;
  memberCount: number;
  sampleVariants: string[];
  createdAt: string;
  lastUpdatedAt: string;
  userIds?: string[];
  solutions?: Solution[];
}

export interface ProblemRecord {
  id: string;
  rawText: string;
  category: string;
  clusterId: string;
  createdAt: string;
}

export interface CategoryWithCount {
  id: string;
  label: string;
  description: string;
  clusterCount: number;
  problemCount: number;
}

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || 'p-x1-problems';

// ==========================================
// 🛡️ DUAL-LAYER IN-MEMORY ROBUST BACKUP
// ==========================================
// Activates automatically if Pinecone is unconfigured, or when network outages/timeouts occur.
interface GlobalDB {
  clusters: Map<string, { record: ClusterRecord; embedding: number[] }>;
  problems: Map<string, { record: ProblemRecord; embedding: number[] }>;
}

const globalForDb = global as unknown as { __p_x1_db?: GlobalDB };
if (!globalForDb.__p_x1_db) {
  globalForDb.__p_x1_db = {
    clusters: new Map(),
    problems: new Map(),
  };
}
const localDb = globalForDb.__p_x1_db;

const isPineconeActive = 
  PINECONE_API_KEY && 
  PINECONE_API_KEY !== 'your-pinecone-api-key' && 
  PINECONE_API_KEY.trim() !== '';

let wasPineconeOutage = false;

export function isPineconeLive(): boolean {
  if (!isPineconeActive) return false;
  return !wasPineconeOutage;
}

// Shared instance or function to get index
let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone {
  if (!PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY is missing.');
  }
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: PINECONE_API_KEY,
    });
  }
  return pineconeClient;
}

export function getPineconeIndex() {
  const client = getPineconeClient();
  return client.index(PINECONE_INDEX);
}

// Generate dummy non-zero unit vector for metadata-only searches
// (Avoids Cosine division-by-zero errors on Pinecone indexes)
export function getZeroVector(dimensions = 1536): number[] {
  const vec = new Array(dimensions).fill(0);
  vec[0] = 1.0;
  return vec;
}

// Cosine dot product helper for fallback semantic matching
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

/**
 * Helper to dynamically join dynamic cluster state and solutions from MongoDB to a list of clusters.
 */
async function joinMongoDataToClusters(clusters: ClusterRecord[]): Promise<ClusterRecord[]> {
  if (clusters.length === 0) return clusters;
  try {
    const { getDb } = await import('./mongodb');
    const db = await getDb();
    const clusterIds = clusters.map(c => c.id);
    
    // Fetch solutions and dynamic cluster data in parallel
    const [solutions, mongoClusters] = await Promise.all([
      db.collection('solutions').find({ clusterId: { $in: clusterIds } }).toArray(),
      db.collection('clusters').find({ id: { $in: clusterIds } }).toArray()
    ]);

    // Group solutions by clusterId
    const solutionsByCluster = solutions.reduce((acc: Record<string, Solution[]>, sol: any) => {
      const cId = sol.clusterId;
      if (cId) {
        if (!acc[cId]) {
          acc[cId] = [];
        }
        acc[cId].push({
          id: sol.id,
          name: sol.name,
          url: sol.url,
          description: sol.description,
          builderId: sol.builderId,
          builderName: sol.builderName,
          upvotes: Number(sol.upvotes || 0),
          votesUserIds: Array.isArray(sol.votesUserIds) ? sol.votesUserIds : [],
          createdAt: sol.createdAt || new Date().toISOString(),
          iconUrl: sol.iconUrl || '/placeholder-solution-icon.png'
        });
      }
      return acc;
    }, {} as Record<string, Solution[]>);

    // Map dynamic cluster data into a dictionary for O(1) lookup
    const mongoClustersById = mongoClusters.reduce((acc: Record<string, any>, c: any) => {
      acc[c.id] = c;
      return acc;
    }, {} as Record<string, any>);

    for (const cluster of clusters) {
      cluster.solutions = solutionsByCluster[cluster.id] || [];
      
      const dynData = mongoClustersById[cluster.id];
      if (dynData) {
        cluster.memberCount = typeof dynData.memberCount === 'number' ? dynData.memberCount : cluster.memberCount;
        cluster.sampleVariants = Array.isArray(dynData.sampleVariants) ? dynData.sampleVariants : cluster.sampleVariants;
        cluster.userIds = Array.isArray(dynData.userIds) ? dynData.userIds : cluster.userIds;
        cluster.createdAt = dynData.createdAt || cluster.createdAt;
        cluster.lastUpdatedAt = dynData.lastUpdatedAt || cluster.lastUpdatedAt;
      }
    }
  } catch (error) {
    console.warn('[pinecone.ts] Failed to join MongoDB data to clusters:', error);
    for (const cluster of clusters) {
      if (!cluster.solutions) cluster.solutions = [];
    }
  }
  return clusters;
}

/**
 * Fetch all clusters from Pinecone, optionally filtered by category.
 */
export async function getClusters(category?: string): Promise<ClusterRecord[]> {
  if (!isPineconeActive) {
    return joinMongoDataToClusters(getLocalClusters(category));
  }

  try {
    const index = getPineconeIndex();
    const queryVector = getZeroVector();
    
    const filter: Record<string, any> = { type: { $eq: 'cluster' } };
    if (category) {
      filter.category = { $eq: category };
    }

    const queryResponse = await index.query({
      vector: queryVector,
      topK: 100,
      includeMetadata: true,
      filter,
    });

    const clusters: ClusterRecord[] = [];
    if (queryResponse.matches) {
      for (const match of queryResponse.matches) {
        if (match.metadata) {
          const meta = match.metadata as any;
          clusters.push({
            id: match.id,
            category: meta.category,
            categoryLabel: meta.categoryLabel || 'Uncategorized',
            categoryDescription: meta.categoryDescription || '',
            canonicalText: meta.canonicalText || '',
            memberCount: Number(meta.memberCount || 0),
            sampleVariants: Array.isArray(meta.sampleVariants) 
              ? meta.sampleVariants 
              : typeof meta.sampleVariants === 'string'
              ? JSON.parse(meta.sampleVariants)
              : [],
            createdAt: meta.createdAt || new Date().toISOString(),
            lastUpdatedAt: meta.lastUpdatedAt || new Date().toISOString(),
            userIds: Array.isArray(meta.userIds) 
              ? meta.userIds 
              : typeof meta.userIds === 'string'
              ? JSON.parse(meta.userIds)
              : [],
            solutions: [], // Dynamically fetched from MongoDB instead
          });
        }
      }
    }
    
    const sorted = clusters.sort((a, b) => b.memberCount - a.memberCount);
    wasPineconeOutage = false; // 🚀 Success!
    return joinMongoDataToClusters(sorted);
  } catch (error) {
    wasPineconeOutage = true; // 🚀 Outage!
    console.warn('[Pinecone] Connection timeout/outage. Falling back to local in-memory records.', error);
    return joinMongoDataToClusters(getLocalClusters(category));
  }
}

/**
 * Fetch a single cluster by ID.
 */
export async function getClusterById(id: string): Promise<ClusterRecord | null> {
  if (!isPineconeActive) {
    const local = getLocalClusterById(id);
    return local ? (await joinMongoDataToClusters([local]))[0] : null;
  }

  try {
    const index = getPineconeIndex();
    const fetchResponse = await index.fetch({ ids: [id] });
    
    const record = fetchResponse.records?.[id];
    if (!record || !record.metadata) {
      const local = getLocalClusterById(id);
      return local ? (await joinMongoDataToClusters([local]))[0] : null;
    }
    
    const meta = record.metadata as any;
    const cluster: ClusterRecord = {
      id: record.id,
      category: meta.category,
      categoryLabel: meta.categoryLabel || 'Uncategorized',
      categoryDescription: meta.categoryDescription || '',
      canonicalText: meta.canonicalText || '',
      memberCount: Number(meta.memberCount || 0),
      sampleVariants: Array.isArray(meta.sampleVariants) 
        ? meta.sampleVariants 
        : typeof meta.sampleVariants === 'string'
        ? JSON.parse(meta.sampleVariants)
        : [],
      createdAt: meta.createdAt || new Date().toISOString(),
      lastUpdatedAt: meta.lastUpdatedAt || new Date().toISOString(),
      userIds: Array.isArray(meta.userIds) 
        ? meta.userIds 
        : typeof meta.userIds === 'string'
        ? JSON.parse(meta.userIds)
        : [],
      solutions: [], // Dynamically fetched from MongoDB instead
    };

    wasPineconeOutage = false; // 🚀 Success!
    return (await joinMongoDataToClusters([cluster]))[0];
  } catch (error) {
    wasPineconeOutage = true; // 🚀 Outage!
    console.warn(`[Pinecone] Failed to fetch cluster ${id}. Falling back to in-memory.`);
    const local = getLocalClusterById(id);
    return local ? (await joinMongoDataToClusters([local]))[0] : null;
  }
}

/**
 * Perform a semantic vector search against cluster centroids.
 */
export async function searchClusters(queryEmbedding: number[], limit = 5): Promise<(ClusterRecord & { score?: number })[]> {
  if (!isPineconeActive) {
    return joinMongoDataToClusters(searchLocalClusters(queryEmbedding, limit));
  }

  try {
    const index = getPineconeIndex();
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: limit,
      includeMetadata: true,
      filter: { type: { $eq: 'cluster' } },
    });

    const results: (ClusterRecord & { score?: number })[] = [];
    if (queryResponse.matches) {
      for (const match of queryResponse.matches) {
        if (match.metadata) {
          const meta = match.metadata as any;
          results.push({
            id: match.id,
            category: meta.category,
            categoryLabel: meta.categoryLabel || 'Uncategorized',
            categoryDescription: meta.categoryDescription || '',
            canonicalText: meta.canonicalText || '',
            memberCount: Number(meta.memberCount || 0),
            sampleVariants: Array.isArray(meta.sampleVariants) 
              ? meta.sampleVariants 
              : typeof meta.sampleVariants === 'string'
              ? JSON.parse(meta.sampleVariants)
              : [],
            createdAt: meta.createdAt || new Date().toISOString(),
            lastUpdatedAt: meta.lastUpdatedAt || new Date().toISOString(),
            userIds: Array.isArray(meta.userIds) 
              ? meta.userIds 
              : typeof meta.userIds === 'string'
              ? JSON.parse(meta.userIds)
              : [],
            solutions: [], // Dynamically fetched from MongoDB instead
            score: match.score,
          });
        }
      }
    }
    wasPineconeOutage = false; // 🚀 Success!
    return joinMongoDataToClusters(results);
  } catch (error) {
    wasPineconeOutage = true; // 🚀 Outage!
    console.warn('[Pinecone] Similarity search connection failed. Running fallback local vector scanner.');
    return joinMongoDataToClusters(searchLocalClusters(queryEmbedding, limit));
  }
}

/**
 * Find adjacent clusters in vector space.
 */
export async function getAdjacentClusters(clusterId: string, limit = 4): Promise<ClusterRecord[]> {
  if (!isPineconeActive) {
    return joinMongoDataToClusters(getLocalAdjacentClusters(clusterId, limit));
  }

  try {
    const index = getPineconeIndex();
    const fetchResponse = await index.fetch({ ids: [clusterId] });
    const record = fetchResponse.records?.[clusterId];
    if (!record || !record.values) return joinMongoDataToClusters(getLocalAdjacentClusters(clusterId, limit));
    
    const queryResponse = await index.query({
      vector: record.values,
      topK: limit + 1,
      includeMetadata: true,
      filter: { 
        type: { $eq: 'cluster' },
        id: { $ne: clusterId }
      },
    });

    const results: ClusterRecord[] = [];
    if (queryResponse.matches) {
      for (const match of queryResponse.matches) {
        if (match.metadata) {
          const meta = match.metadata as any;
          results.push({
            id: match.id,
            category: meta.category,
            categoryLabel: meta.categoryLabel || 'Uncategorized',
            categoryDescription: meta.categoryDescription || '',
            canonicalText: meta.canonicalText || '',
            memberCount: Number(meta.memberCount || 0),
            sampleVariants: Array.isArray(meta.sampleVariants) 
              ? meta.sampleVariants 
              : typeof meta.sampleVariants === 'string'
              ? JSON.parse(meta.sampleVariants)
              : [],
            createdAt: meta.createdAt || new Date().toISOString(),
            lastUpdatedAt: meta.lastUpdatedAt || new Date().toISOString(),
            userIds: Array.isArray(meta.userIds) 
              ? meta.userIds 
              : typeof meta.userIds === 'string'
              ? JSON.parse(meta.userIds)
              : [],
            solutions: [], // Dynamically fetched from MongoDB instead
          });
        }
      }
    }
    const sliced = results.slice(0, limit);
    wasPineconeOutage = false; // 🚀 Success!
    return joinMongoDataToClusters(sliced);
  } catch (error) {
    wasPineconeOutage = true; // 🚀 Outage!
    console.warn(`[Pinecone] Failed to compute adjacencies for ${clusterId}. Fallback active.`);
    return joinMongoDataToClusters(getLocalAdjacentClusters(clusterId, limit));
  }
}

/**
 * Upsert a cluster (create or update).
 */
export async function upsertCluster(cluster: ClusterRecord, embedding: number[]): Promise<void> {
  // Always update in local memory so local states match even if Pinecone succeeds
  localDb.clusters.set(cluster.id, { record: cluster, embedding });

  if (!isPineconeActive) return;

  try {
    const index = getPineconeIndex();
    await index.upsert({
      records: [{
        id: cluster.id,
        values: embedding,
        metadata: {
          type: 'cluster',
          category: cluster.category,
          categoryLabel: cluster.categoryLabel,
          categoryDescription: cluster.categoryDescription,
          canonicalText: cluster.canonicalText,
          // Dynamic fields (memberCount, sampleVariants, userIds, timestamps) 
          // are now stored EXCLUSIVELY in MongoDB! 🚀
        }
      }]
    });
    wasPineconeOutage = false; // 🚀 Success!
  } catch (error) {
    wasPineconeOutage = true; // 🚀 Outage!
    console.warn('[Pinecone] Outage during upsert cluster. Local records updated instead.');
  }
}

/**
 * Insert a raw problem.
 */
export async function insertProblem(problem: ProblemRecord, embedding: number[]): Promise<void> {
  localDb.problems.set(problem.id, { record: problem, embedding });

  if (!isPineconeActive) return;

  try {
    const index = getPineconeIndex();
    await index.upsert({
      records: [{
        id: problem.id,
        values: embedding,
        metadata: {
          type: 'problem',
          rawText: problem.rawText,
          category: problem.category,
          clusterId: problem.clusterId,
          createdAt: problem.createdAt,
        }
      }]
    });
  } catch (error) {
    console.warn('[Pinecone] Outage during insert problem. Local records updated instead.');
  }
}

/**
 * Retrieves all raw problems belonging to a specific cluster ID.
 */
export async function getProblemsByClusterId(clusterId: string): Promise<ProblemRecord[]> {
  if (!isPineconeActive) {
    return Array.from(localDb.problems.values())
      .filter(p => p.record.clusterId === clusterId)
      .map(p => p.record);
  }

  try {
    const index = getPineconeIndex();
    const queryResponse = await index.query({
      vector: getZeroVector(), // Dummy vector search for metadata-only matching
      topK: 100,
      includeMetadata: true,
      filter: { 
        type: { $eq: 'problem' },
        clusterId: { $eq: clusterId }
      }
    });

    const problems: ProblemRecord[] = [];
    if (queryResponse.matches) {
      for (const match of queryResponse.matches) {
        if (match.metadata) {
          const meta = match.metadata as any;
          problems.push({
            id: match.id,
            rawText: meta.rawText || '',
            category: meta.category || '',
            clusterId: meta.clusterId || '',
            createdAt: meta.createdAt || new Date().toISOString(),
          });
        }
      }
    }
    return problems;
  } catch (error: any) {
    console.warn(`[Pinecone] Failed to query problems by clusterId ${clusterId}. Error: ${error?.message || error}. Fallback active.`);
    return Array.from(localDb.problems.values())
      .filter(p => p.record.clusterId === clusterId)
      .map(p => p.record);
  }
}

/**
 * Fetches a single Problem Record and its embedding vector by ID.
 */
export async function getProblemById(id: string): Promise<{ record: ProblemRecord, embedding: number[] } | null> {
  const item = localDb.problems.get(id);

  if (!isPineconeActive) {
    return item ? { record: item.record, embedding: item.embedding } : null;
  }

  try {
    const index = getPineconeIndex();
    const fetchResponse = await index.fetch({ ids: [id] });
    const record = fetchResponse.records ? fetchResponse.records[id] : null;
    if (!record || !record.metadata) {
      return item ? { record: item.record, embedding: item.embedding } : null;
    }

    const meta = record.metadata as any;
    const problemRecord: ProblemRecord = {
      id: record.id,
      rawText: meta.rawText || '',
      category: meta.category || '',
      clusterId: meta.clusterId || '',
      createdAt: meta.createdAt || new Date().toISOString(),
    };

    return {
      record: problemRecord,
      embedding: record.values || [],
    };
  } catch (error) {
    console.warn(`[Pinecone] Failed to fetch problem ${id}. Falling back to local memory.`);
    return item ? { record: item.record, embedding: item.embedding } : null;
  }
}

/**
 * Fetch categories dynamically from clusters.
 */
export async function getCategories(): Promise<CategoryWithCount[]> {
  try {
    const clusters = await getClusters();
    const categoryMap: Record<string, { label: string; description: string; clusterCount: number; problemCount: number }> = {};
    
    for (const cluster of clusters) {
      if (!categoryMap[cluster.category]) {
        categoryMap[cluster.category] = {
          label: cluster.categoryLabel,
          description: cluster.categoryDescription,
          clusterCount: 0,
          problemCount: 0,
        };
      }
      categoryMap[cluster.category].clusterCount += 1;
      categoryMap[cluster.category].problemCount += cluster.memberCount;
    }

    return Object.entries(categoryMap).map(([id, data]) => ({
      id,
      label: data.label,
      description: data.description,
      clusterCount: data.clusterCount,
      problemCount: data.problemCount,
    }));
  } catch (error) {
    console.error('Error compiling categories:', error);
    return [];
  }
}

// ==========================================
// 🛡️ LOCAL IN-MEMORY REPLICA IMPLEMENTATIONS
// ==========================================

function getLocalClusters(category?: string): ClusterRecord[] {
  const records = Array.from(localDb.clusters.values()).map(c => c.record);
  const filtered = category ? records.filter(r => r.category === category) : records;
  return filtered.sort((a, b) => b.memberCount - a.memberCount);
}

function getLocalClusterById(id: string): ClusterRecord | null {
  const item = localDb.clusters.get(id);
  return item ? item.record : null;
}

function searchLocalClusters(queryEmbedding: number[], limit = 5): (ClusterRecord & { score?: number })[] {
  const clusters = Array.from(localDb.clusters.values());
  const scored = clusters.map(c => ({
    ...c.record,
    score: getCosineSimilarity(queryEmbedding, c.embedding),
  }));
  // Sort by similarity descending
  const sorted = scored.sort((a, b) => b.score - a.score);
  return sorted.slice(0, limit);
}

function getLocalAdjacentClusters(clusterId: string, limit = 4): ClusterRecord[] {
  const target = localDb.clusters.get(clusterId);
  if (!target) return [];

  const otherClusters = Array.from(localDb.clusters.entries())
    .filter(([id]) => id !== clusterId)
    .map(([_, v]) => ({
      ...v.record,
      score: getCosineSimilarity(target.embedding, v.embedding)
    }));

  const sorted = otherClusters.sort((a, b) => b.score - a.score);
  return sorted.slice(0, limit);
}

/**
 * Completely flushes every record in the Pinecone Index (and clears the local memory replica).
 * Designed for fresh start seeding and local test environments.
 */
export async function wipePineconeIndex(): Promise<void> {
  // 1. Clear local memory database replica
  localDb.clusters.clear();
  localDb.problems.clear();

  if (!isPineconeActive) {
    console.log('[Pinecone] Offline fallback: cleared local memory database replica successfully.');
    return;
  }

  // 2. Clear remote Pinecone index
  try {
    const index = getPineconeIndex();
    await index.deleteAll();
    console.log('[Pinecone] Remote index cleared successfully.');
  } catch (error: any) {
    console.error('[Pinecone] Failed to clear remote index:', error?.message || error);
    throw new Error(`Failed to flush Pinecone index: ${error?.message || error}`);
  }
}
