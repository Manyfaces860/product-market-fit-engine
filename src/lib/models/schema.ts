import { ObjectId } from 'mongodb';

/**
 * 🌲 MongoDB "clusters" Collection Document Schema
 * Holds both static conceptual vector taxonomy (for fast semantic match searches)
 * and highly dynamic voice metrics/sample variants.
 */
export interface MongoClusterDocument {
  _id?: ObjectId;
  id: string;                  // Unique cluster ID (e.g., "cluster_seed_ai-operations")
  category: string;            // Machine-readable category key (e.g., "ai-operations")
  categoryLabel: string;       // Human-readable category label (e.g., "AI & Data Infrastructure")
  categoryDescription: string; // Dynamic description of this category niche
  canonicalText: string;       // Main conceptual problem title / headline of the cluster
  memberCount: number;         // Total support counts (Me Too voices)
  variantCount?: number;       // 🚀 Total phrasing variants count (for ultra-fast lists without loading arrays!)
  sampleVariants: string[];    // Uncapped array of crowdsourced phrasing variants
  userIds?: string[];          // Clerk User IDs of co-sign supports (idempotency)
  creatorId?: string;          // 🚀 Clerk User ID of the original reporter who created/seeded the cluster
  createdAt: string;           // Timestamp
  lastUpdatedAt: string;       // Timestamp
  
  // 🚀 MongoDB Atlas Vector Search field
  embedding?: number[];        // The 1,536-dimensional vector centroid

  // 🚀 Dynamic solutions merged in-memory
  solutions?: any[];
}

/**
 * 📝 MongoDB "problems" Collection Document Schema
 * Represents raw, unedited user complaints submitted historically (the evidence ledger).
 */
export interface MongoProblemDocument {
  _id?: ObjectId;
  id: string;                  // Unique Problem ID (e.g., "prob_12345")
  clusterId: string;           // Relational link pointing back to MongoClusterDocument.id
  category: string;            // Category alignment key (e.g., "ai-operations")
  rawText: string;             // Original user phrasing text
  userId: string;              // 🚀 Clerk User ID of the reporter who submitted this phrase
  createdAt: string;           // Timestamp
  
  // 🚀 Optional Vector field
  embedding?: number[];        // The 1,536-dimensional vector embedding of this raw phrase
}

/**
 * 🛠️ MongoDB "solutions" Collection Document Schema
 * Represents software or hardware product listings submitted by founders/builders.
 */
export interface MongoSolutionDocument {
  _id?: ObjectId;
  id: string;                  // Unique Solution ID (e.g., "sol_12345")
  clusterId: string;           // Relational link pointing back to MongoClusterDocument.id it solves
  name: string;                // Product name
  url: string;                 // Product web link URL (XSS protocol protected)
  description: string;         // Description copy explaining how it solves the pain points
  builderId: string;           // Clerk User ID of the listing builder
  builderName: string;         // Name of the listing builder
  upvotes: number;             // Upvote score counter (net score: Upvotes - Downvotes)
  votesUserIds: string[];      // Clerk User IDs of upvoters (idempotency upvote guard)
  downvotedUserIds?: string[]; // Clerk User IDs of downvoters (idempotency downvote guard) 🛡️
  createdAt: string;           // Timestamp
  lastUpdatedAt?: string;      // Timestamp
  iconUrl?: string;            // URL for product icon logo
}

/**
 * 💬 MongoDB "reviews" Collection Document Schema
 * Represents star ratings and written reviews/feedback submitted for solutions.
 */
export interface MongoReviewDocument {
  _id?: ObjectId;
  clusterId: string;           // Relational link pointing back to MongoClusterDocument.id
  solutionId: string;          // Relational link pointing back to MongoSolutionDocument.id
  userId: string;              // Clerk User ID of the reviewer
  userName: string;            // Name of the reviewer
  rating: number;              // 1 to 5 star rating
  text: string;                // Written review feedback comment
  createdAt: string;           // Timestamp
}

/**
 * 👤 MongoDB "users" Collection Document Schema
 * Manages user roles, permission perks, and customizable builder profiles.
 */
export interface MongoUserDocument {
  _id?: ObjectId;
  userId: string;              // Clerk User ID (Primary Query Key)
  email: string;               // User's primary email address
  name: string;                // User's display name
  role: 'reporter' | 'builder' | 'admin'; // User Role / Perks Tier
  createdAt: string;           // Join date
  
  // 🏆 Custom Builder Profile Perks (Unlocked when promoted to Builder!)
  customBio?: string;          // Founder/builder tagline/bio
  githubUrl?: string;          // Link to builder's GitHub
  websiteUrl?: string;         // Link to builder's portfolio / landing page
}

/**
 * 📊 UI-Compatible Category Summary
 * Returned by getCategories() to display active category statistics on the dashboard.
 */
export interface CategoryWithCount {
  id: string;
  label: string;
  description: string;
  clusterCount: number;
  problemCount: number;
}