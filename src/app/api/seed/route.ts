import { NextRequest, NextResponse } from 'next/server';
import { embeddingService } from '@/lib/ai';
import { upsertCluster, insertProblem, ClusterRecord, ProblemRecord } from '@/lib/pinecone';

// Pre-defined builder-focused sample clusters with realistic, actionable developer/founder pain points
const SEED_CLUSTERS = [
  {
    category: 'software-devtools',
    categoryLabel: 'Developer Tools & DX',
    categoryDescription: 'Friction in local developer workflows, compilation bottlenecks, flaky testing environments, and monorepo configurations.',
    canonicalText: 'Flaky local testing setups and slow hot-reload compilation times in microfrontend development',
    memberCount: 54,
    sampleVariants: [
      'Our Cypress tests fail 20% of the time locally with no code changes, making PR merges a nightmare.',
      'Running microfrontends locally takes 16GB of RAM and compiling takes over 3 minutes on every change.',
      'Flaky integration tests are destroying our team development velocity and causing deployment anxiety.',
      'Is there any tool that mocks module federation locally so we don\'t have to spin up 12 independent repositories?',
      'Webpack hot-reloading fails completely when running module federation in watch mode on larger monorepos.',
    ],
  },
  {
    category: 'software-saas',
    categoryLabel: 'SaaS & B2B Productivity',
    categoryDescription: 'Administrative bottlenecks, calendar coordination headaches, and collaborative document syncing issues.',
    canonicalText: 'No simple way to automatically sync real-time calendar availability across multiple independent external organizations',
    memberCount: 38,
    sampleVariants: [
      'Our client agency has to coordinate meetings with 5 teams, and we spend hours matching Calendly links.',
      'I have a personal calendar, a work calendar, and a client calendar. Keeping them in sync manually is impossible.',
      'Is there a tool that blocks slots on client Calendly when my internal personal calendar gets booked?',
      'Manual double-booking checks across different Google Workspace organizations is a major daily headache.',
      'We need a shared availability pool for contractors that doesn\'t leak private meeting titles or client names.',
    ],
  },
  {
    category: 'hardware-iot',
    categoryLabel: 'Hardware & Smart Devices',
    categoryDescription: 'Physical gadget issues, router band pairing headaches, and customized adapter shortages.',
    canonicalText: 'Difficulties pairing smart-home Zigbee/Matter devices across combined dual-band router bands',
    memberCount: 29,
    sampleVariants: [
      'My smart lightbulbs won\'t connect because my mesh router combines 2.4GHz and 5GHz bands into a single SSID.',
      'Matter IoT devices failing to pair locally unless I disable my router\'s firewall completely.',
      'I need a physical hardware bridge that handles Zigbee pairing without relying on proprietary, insecure cloud servers.',
      'Spent hours resetting my IoT hub just because my dual-band router rotated its IP address leases.',
    ],
  },
  {
    category: 'ecommerce-ops',
    categoryLabel: 'E-commerce & Shipping Ops',
    categoryDescription: 'Multi-channel inventory syncing, custom label printing bottlenecks, and automated return processing.',
    canonicalText: 'Inaccurate real-time inventory counts when cross-listing products on Shopify, Etsy, and eBay',
    memberCount: 43,
    sampleVariants: [
      'I oversold an item on Etsy because someone bought the last one on Shopify 2 minutes earlier, forcing a refund.',
      'Manually copying stock quantities between multiple seller portals is extremely tedious and error-prone.',
      'There\'s no reliable webhook syncing tool that updates stock level decimals across retail platforms instantly.',
      'Double listing physical inventory often leads to bad reviews due to delayed syncing or missing stock alerts.',
    ],
  },
  {
    category: 'ai-operations',
    categoryLabel: 'AI & Data Infrastructure',
    categoryDescription: 'High LLM processing latencies, vector indexing sync issues, rate-limiting, and unstructured document parsing.',
    canonicalText: 'Extremely high latency and token costs when parsing massive unstructured PDF contracts using LLMs',
    memberCount: 48,
    sampleVariants: [
      'Parsing 200-page lease agreements with Claude is costing us $10 per contract and takes over 40 seconds.',
      'We are hitting token rate limits constantly when chunking large legal documents for vector RAG databases.',
      'No easy way to extract tables from scanned PDF invoices without losing key column associations.',
      'Extracting nested text boxes from legal PDFs with standard parsers yields completely scrambled text.',
    ],
  },
];

export async function GET(req: NextRequest) {
  try {
    const nowStr = new Date().toISOString();
    let seededCount = 0;

    for (const item of SEED_CLUSTERS) {
      const clusterId = `cluster_seed_${item.category}`;
      
      const record: ClusterRecord = {
        id: clusterId,
        category: item.category,
        categoryLabel: item.categoryLabel,
        categoryDescription: item.categoryDescription,
        canonicalText: item.canonicalText,
        memberCount: item.memberCount,
        sampleVariants: item.sampleVariants,
        createdAt: nowStr,
        lastUpdatedAt: nowStr,
      };

      // Generate embedding for canonical text
      const embedding = await embeddingService.getEmbedding(item.canonicalText);
      await upsertCluster(record, embedding);
      
      // Seed each sample variant as an individual Problem Record in Pinecone!
      let variantIdx = 1;
      for (const variantText of item.sampleVariants) {
        const problemId = `prob_seed_${item.category}_${variantIdx++}`;
        const problemRecord: ProblemRecord = {
          id: problemId,
          rawText: variantText,
          category: item.category,
          clusterId: clusterId,
          createdAt: nowStr,
        };

        const variantEmbedding = await embeddingService.getEmbedding(variantText);
        await insertProblem(problemRecord, variantEmbedding);
      }

      seededCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${seededCount} builder-focused clusters and their raw user problems in Pinecone!`,
    });
  } catch (error: any) {
    console.error('Error seeding Pinecone index:', error);
    return NextResponse.json({
      error: 'Seed Failed',
      message: error.message || 'Make sure your PINECONE_API_KEY and index are properly configured.',
    }, { status: 500 });
  }
}
