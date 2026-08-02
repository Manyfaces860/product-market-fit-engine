import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import { OpenAI } from 'openai';
import staticCategories from '../src/lib/ai/static-categories';

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
// 📋 DYNAMICALLY LOAD THE 13 CORE STATIC CATEGORIES
// -------------------------------------------------------------
const CANONICAL_TARGETS = staticCategories.map(cat => ({
  category: cat.id,
  label: cat.label,
  text: cat.description
}));

// -------------------------------------------------------------
// 🧪 COMPREHENSIVE TEST CASES (13 POSITIVE, 2 NEGATIVE)
// -------------------------------------------------------------
const TEST_CASES = [
  {
    input: "Cypress integration tests randomly crash locally on our modular federated codebases, it is destroying developer velocity.",
    expectedCategory: 'software-devtools',
    intent: "Verify DevTools match"
  },
  {
    input: "I run an agency and coordinating bookings with 5 client teams via different shared Calendly links is taking hours.",
    expectedCategory: 'software-saas',
    intent: "Verify SaaS & B2B Productivity match"
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
    input: "Our finance team is spending hours every Friday manually matching bank transfer CSV exports to Stripe invoice IDs.",
    expectedCategory: 'fintech-payments',
    intent: "Verify Fintech & Payments match"
  },
  {
    input: "The new hire onboarding process is just a huge thread in Slack with 15 different links to PDF forms and Notion docs.",
    expectedCategory: 'hr-people-ops',
    intent: "Verify HR & People Ops match"
  },
  {
    input: "We have no central way to track who has access to which production databases, and our SOC2 auditor is going to reject this.",
    expectedCategory: 'security-compliance',
    intent: "Verify Security & Compliance match"
  },
  {
    input: "Customers are getting frustrated because Zendesk keeps routing billing issues to our tier-1 technical support team.",
    expectedCategory: 'customer-support',
    intent: "Verify Customer Support match"
  },
  {
    input: "I had to fill out the exact same physical paper medical history form at three different clinics owned by the same hospital network.",
    expectedCategory: 'healthtech',
    intent: "Verify Health & Wellness match"
  },
  {
    input: "My budgeting app completely misses my rent payments because they go through Venmo and get categorized as general transfers.",
    expectedCategory: 'consumer-finance',
    intent: "Verify Personal Finance & Budgeting match"
  },
  {
    input: "When migrating our courses from Canvas to Moodle, half of the student grade histories and uploaded assignments were completely corrupted.",
    expectedCategory: 'edtech-learning',
    intent: "Verify Education & Learning match"
  },
  {
    input: "Getting our security deposit back took 6 weeks and 40 back-and-forth emails because the landlord kept losing the receipts.",
    expectedCategory: 'real-estate-housing',
    intent: "Verify Real Estate & Housing match"
  },
  {
    input: "The weather in Seattle is so rainy and damp, I can't stand it.",
    expectedCategory: 'none',
    intent: "Verify unrelated general complaint is isolated"
  },
  {
    input: "What is the capital of France? I need to know for a trivia game tonight.",
    expectedCategory: 'none',
    intent: "Verify unrelated trivia/question is isolated"
  }
];

async function runSemanticRetrievalTest() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small';
  
  if (!apiKey) {
    console.error("\n❌ Error: OPENROUTER_API_KEY is missing in your .env file.");
    process.exit(1);
  }

  const openai = new OpenAI({ 
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey 
  });

  console.log("\n=============================================================");
  console.log("⚡ CORE RETRIEVAL ENGINE: OPENROUTER SIMILARITY TESTING ⚡");
  console.log(`📡 Model: ${model}`);
  console.log(`📁 Loaded Categories: ${CANONICAL_TARGETS.length} from static-categories.ts`);
  console.log("=============================================================\n");
  console.log("Computing embeddings for the 13 static category descriptions...");

  try {
    const targetTexts = CANONICAL_TARGETS.map(t => t.text);
    const targetResponse = await openai.embeddings.create({
      model,
      input: targetTexts,
    });
    
    const targetsWithVectors = CANONICAL_TARGETS.map((target, index) => ({
      ...target,
      vector: targetResponse.data[index].embedding
    }));

    console.log("✅ Category description vectors generated successfully.\n");
    console.log("-------------------------------------------------------------");
    console.log("Running user complaints through the matching matrix...");
    console.log("-------------------------------------------------------------\n");

    // We'll test multiple thresholds to find the sweet spot
    const candidateThresholds = [0.30, 0.35, 0.38, 0.40, 0.42, 0.45, 0.50];
    const thresholdResults = candidateThresholds.map(t => ({ threshold: t, passed: 0, failed: 0 }));

    // Store all computed scores for analysis
    const testCasesScored: Array<{
      input: string;
      intent: string;
      expectedCategory: string;
      bestMatchCategory: string;
      bestMatchScore: number;
      secondBestMatchCategory: string;
      secondBestMatchScore: number;
      scores: Array<{ category: string; score: number }>;
    }> = [];

    for (let idx = 0; idx < TEST_CASES.length; idx++) {
      const tc = TEST_CASES[idx];
      console.log(`[Test #${idx + 1}/${TEST_CASES.length}] Intent: ${tc.intent}`);
      console.log(`💬 Raw User Complaint: "${tc.input}"`);

      const inputResponse = await openai.embeddings.create({
        model,
        input: [tc.input],
      });
      const inputVector = inputResponse.data[0].embedding;

      const scoredMatches = targetsWithVectors.map(target => {
        const similarity = getCosineSimilarity(inputVector, target.vector);
        return {
          category: target.category,
          label: target.label,
          similarity: Number(similarity.toFixed(4))
        };
      });

      scoredMatches.sort((a, b) => b.similarity - a.similarity);
      const bestMatch = scoredMatches[0];
      const secondBestMatch = scoredMatches[1];

      testCasesScored.push({
        input: tc.input,
        intent: tc.intent,
        expectedCategory: tc.expectedCategory,
        bestMatchCategory: bestMatch.category,
        bestMatchScore: bestMatch.similarity,
        secondBestMatchCategory: secondBestMatch.category,
        secondBestMatchScore: secondBestMatch.similarity,
        scores: scoredMatches.map(m => ({ category: m.category, score: m.similarity }))
      });

      console.log("📊 Top 5 Cosine Similarity Scores:");
      scoredMatches.slice(0, 5).forEach(match => {
        const barLength = Math.round(match.similarity * 20);
        const bar = "█".repeat(Math.max(0, barLength)) + "░".repeat(Math.max(0, 20 - barLength));
        console.log(`  • [${match.category.padEnd(20)}] Score: ${match.similarity.toFixed(4)} ${bar} (${match.label})`);
      });
      console.log("-------------------------------------------------------------");
    }

    // Now, run evaluation for each candidate threshold!
    console.log("\n=============================================================");
    console.log("📈 THRESHOLD PERFORMANCE CALIBRATION REPORT 📈");
    console.log("=============================================================\n");

    candidateThresholds.forEach((threshold, index) => {
      let passedCount = 0;
      testCasesScored.forEach(tc => {
        const isMergeable = tc.bestMatchScore >= threshold;
        const matchedCategory = isMergeable ? tc.bestMatchCategory : 'none';
        if (matchedCategory === tc.expectedCategory) {
          passedCount++;
        }
      });
      
      const pct = ((passedCount / TEST_CASES.length) * 100).toFixed(0);
      thresholdResults[index].passed = passedCount;
      thresholdResults[index].failed = TEST_CASES.length - passedCount;
      console.log(`Threshold ${threshold.toFixed(2)}: ${passedCount}/${TEST_CASES.length} cases passed (${pct}%)`);
    });

    console.log("\n🔎 Detailed Failure Modes per Threshold:");
    candidateThresholds.forEach(threshold => {
      console.log(`\n--- Threshold ${threshold.toFixed(2)} ---`);
      let failedInThreshold = 0;
      testCasesScored.forEach(tc => {
        const isMergeable = tc.bestMatchScore >= threshold;
        const matchedCategory = isMergeable ? tc.bestMatchCategory : 'none';
        if (matchedCategory !== tc.expectedCategory) {
          failedInThreshold++;
          if (tc.expectedCategory === 'none') {
            console.log(`  ❌ FALSE POSITIVE: "${tc.input}" matched to "${matchedCategory}" with score ${tc.bestMatchScore.toFixed(4)} (Expected rejection: none)`);
          } else {
            if (!isMergeable) {
              console.log(`  ❌ FALSE NEGATIVE: "${tc.input}" was rejected as "none" but should have matched "${tc.expectedCategory}" (Best score: ${tc.bestMatchScore.toFixed(4)})`);
            } else {
              console.log(`  ❌ MISCLASSIFIED: "${tc.input}" matched to "${matchedCategory}" instead of "${tc.expectedCategory}" (Scores: ${tc.bestMatchCategory}=${tc.bestMatchScore.toFixed(4)}, ${tc.expectedCategory}=${tc.scores.find(s => s.category === tc.expectedCategory)?.score.toFixed(4)})`);
            }
          }
        }
      });
      if (failedInThreshold === 0) {
        console.log("  ✨ Perfect! No failures.");
      }
    });

    // Suggest optimal threshold
    const bestThresholdObj = thresholdResults.reduce((best, curr) => curr.passed > best.passed ? curr : best, thresholdResults[0]);
    console.log("\n=============================================================");
    console.log(`🏆 RECOMMENDED THRESHOLD: ${bestThresholdObj.threshold.toFixed(2)}`);
    console.log(`📊 Performance: ${bestThresholdObj.passed}/${TEST_CASES.length} Correct (${((bestThresholdObj.passed/TEST_CASES.length)*100).toFixed(0)}%)`);
    console.log("=============================================================\n");

  } catch (error: any) {
    console.error("❌ Error executing semantic test:", error);
  }
}

runSemanticRetrievalTest();
