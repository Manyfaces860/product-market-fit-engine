import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { getPineconeIndex } from '../src/lib/pinecone';

async function testQueryWithNonZero() {
  console.log("Executing Pinecone query test with NON-ZERO unit vector...");
  try {
    const index = getPineconeIndex();
    const dummyVector = new Array(1536).fill(0);
    dummyVector[0] = 1.0; // Non-zero unit vector

    const queryResponse = await index.query({
      vector: dummyVector,
      topK: 10,
      includeMetadata: true,
      filter: { 
        type: { $eq: 'cluster' } // Let's query clusters (which we know exist!)
      }
    });

    console.log("Query Succeeded! Matches found:", queryResponse.matches?.length);
    if (queryResponse.matches && queryResponse.matches.length > 0) {
      console.log("First Match:", JSON.stringify(queryResponse.matches[0].metadata, null, 2));
    }
  } catch (error: any) {
    console.error("Query Failed:", error?.message || error);
  }
}

testQueryWithNonZero();
