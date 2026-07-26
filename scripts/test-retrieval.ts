import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { OpenAI } from 'openai';

// -------------------------------------------------------------
// 📐 COSINE SIMILARITY MATH HELPER
// -------------------------------------------------------------
function getCosineSimilarity(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length) return 0;
  const dotProduct = v1.reduce((sum, val, i) => sum + val * v2[i], 0);
  const mag1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
  const mag2 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0));
  return mag1 && mag2 ? dotProduct / (mag1 * mag2) : 0;
}

// -------------------------------------------------------------
// 📋 THE 5 CORE BUILDER NICHE CANONICAL TEXTS (SEED DATA)
// -------------------------------------------------------------
const CANONICAL_TARGETS = [
  {
    category: 'software-devtools',
    label: 'Developer Tools & DX',
    text: 'Flaky local testing setups and slow hot-reload compilation times in microfrontend development'
  },
  {
    category: 'software-saas',
    label: 'SaaS & B2B Productivity',
    text: 'No simple way to automatically sync real-time calendar availability across multiple independent external organizations'
  },
  {
    category: 'hardware-iot',
    label: 'Hardware & Smart Devices',
    text: 'Difficulties pairing smart-home Zigbee/Matter devices across combined dual-band router bands'
  },
  {
    category: 'ecommerce-ops',
    label: 'E-commerce & Shipping Ops',
    text: 'Inaccurate real-time inventory counts when cross-listing products on Shopify, Etsy, and eBay'
  },
  {
    category: 'ai-operations',
    label: 'AI & Data Infrastructure',
    text: 'Extremely high latency and token costs when parsing massive unstructured PDF contracts using LLMs'
  }
];

// -------------------------------------------------------------
// 🧪 REAL-WORLD USER TEST CASES (MESSY COMPLAINTS)
// -------------------------------------------------------------
const TEST_CASES = [
  {
    input: "Cypress integration tests randomly crash locally on our modular federated codebases, it is destroying developer velocity.",
    expectedCategory: 'software-devtools',
    intent: "Verify DevTools hot-reload/testing match"
  },
  {
    input: "I run an agency and coordinating bookings with 5 client teams via different shared Calendly links is taking hours.",
    expectedCategory: 'software-saas',
    intent: "Verify Calendar Availability Sync match"
  },
  {
    input: "My mesh router combines 2.4 and 5ghz bands into one name, and now my Zigbee bulbs fail to register.",
    expectedCategory: 'hardware-iot',
    intent: "Verify IoT Router Band pairing match"
  },
  {
    input: "Oversold three items on Etsy today because Shopify stock levels took 10 minutes to sync and update automatically.",
    expectedCategory: 'ecommerce-ops',
    intent: "Verify Multi-channel Inventory sync match"
  },
  {
    input: "We spent $100 today just having Claude read 300-page lease PDFs, and the API calls took over 40 seconds.",
    expectedCategory: 'ai-operations',
    intent: "Verify LLM Token Cost/Latency PDF parsing match"
  },
  {
    input: "The weather in Seattle is so rainy and damp, I can't stand it.",
    expectedCategory: 'none', // Should have low similarity to all
    intent: "Verify non-builder/unrelated complaints are isolated"
  }
];

async function runSemanticRetrievalTest() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small';
  
  if (!apiKey) {
    console.error("\n❌ Error: OPENROUTER_API_KEY is missing in your .env file.");
    console.log("To run real-world vector retrieval tests via OpenRouter, please add your OpenRouter API Key.");
    console.log("The test script requires active embeddings calculations to showcase the exact vector math.\n");
    process.exit(1);
  }

  // Initialize OpenAI client pointing to OpenRouter REST base url
  const openai = new OpenAI({ 
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey 
  });

  console.log("\n=============================================================");
  console.log("⚡ CORE RETRIEVAL ENGINE: OPENROUTER SIMILARITY TESTING ⚡");
  console.log(`📡 Model: ${model}`);
  console.log("=============================================================\n");
  console.log("Computing embeddings for the 5 target niche canonicals...");

  try {
    // 1. Fetch embeddings for canonical targets
    const targetTexts = CANONICAL_TARGETS.map(t => t.text);
    const targetResponse = await openai.embeddings.create({
      model,
      input: targetTexts,
    });
    
    const targetsWithVectors = CANONICAL_TARGETS.map((target, index) => ({
      ...target,
      vector: targetResponse.data[index].embedding
    }));

    console.log("✅ Canonical target vectors generated successfully.\n");
    console.log("-------------------------------------------------------------");
    console.log("Running user complaints through the matching matrix...");
    console.log("-------------------------------------------------------------\n");

    const SIMILARITY_THRESHOLD = 0.40; // Standard merge boundary
    let passedCount = 0;

    for (let idx = 0; idx < TEST_CASES.length; idx++) {
      const tc = TEST_CASES[idx];
      console.log(`[Test #${idx + 1}] Intent: ${tc.intent}`);
      console.log(`💬 Raw User Complaint: "${tc.input}"`);

      // Generate embedding for user input
      const inputResponse = await openai.embeddings.create({
        model,
        input: [tc.input],
      });
      const inputVector = inputResponse.data[0].embedding;

      // Check similarity against all 5 targets
      const scoredMatches = targetsWithVectors.map(target => {
        const similarity = getCosineSimilarity(inputVector, target.vector);
        return {
          ...target,
          similarity: Number(similarity.toFixed(4))
        };
      });

      // Sort matches by highest similarity
      scoredMatches.sort((a, b) => b.similarity - a.similarity);
      const bestMatch = scoredMatches[0];
      const isMergeable = bestMatch.similarity >= SIMILARITY_THRESHOLD;

      console.log("📊 Cosine Similarity Scores:");
      scoredMatches.forEach(match => {
        const barLength = Math.round(match.similarity * 20);
        const bar = "█".repeat(Math.max(0, barLength)) + "░".repeat(Math.max(0, 20 - barLength));
        console.log(`  • [${match.category.padEnd(17)}] Score: ${match.similarity.toFixed(4)} ${bar} (${match.label})`);
      });

      console.log(`\n🎯 Results Decision:`);
      if (isMergeable) {
        console.log(`  👉 MERGE SUCCESS: Score ${bestMatch.similarity} is >= ${SIMILARITY_THRESHOLD}.`);
        console.log(`  👉 Action: Join existing group [${bestMatch.category}] "${bestMatch.text}"`);
      } else {
        console.log(`  👉 SEED FRESH GROUP: Best score ${bestMatch.similarity} is < ${SIMILARITY_THRESHOLD}.`);
        console.log(`  👉 Action: No match found. Seeding a brand new market niche!`);
      }

      // Assertions
      const matchedCategory = isMergeable ? bestMatch.category : 'none';
      if (matchedCategory === tc.expectedCategory) {
        console.log("✨ ASSERTION: [PASSED] - Correctly classified and matched.\n");
        passedCount++;
      } else {
        console.log(`❌ ASSERTION: [FAILED] - Expected "${tc.expectedCategory}" but got "${matchedCategory}"\n`);
      }
      console.log("-------------------------------------------------------------");
    }

    const pct = ((passedCount / TEST_CASES.length) * 100).toFixed(0);
    console.log(`\n🏁 SIMILARITY TESTING COMPLETE: ${passedCount}/${TEST_CASES.length} Cases Passed (${pct}%)`);
    console.log("=============================================================\n");

  } catch (error: any) {
    console.error("❌ Error executing semantic test:", error);
  }
}

runSemanticRetrievalTest();
