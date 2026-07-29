import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { embeddingService } from '@/lib/ai';
import { searchClusters, logMetric } from '@/lib/mongodb';
import { validateQuery } from '@/lib/validation';
import { rateLimit, handleRateLimitResponse } from '@/lib/rate-limit';
import { createResponse } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';

    // 1. Authenticate user for search
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be signed in to perform searches.' },
        { status: 401 }
      );
    }

    // 2. Robust user-based rate limiting 🛡️
    // By keying strictly on userId, the user's rate limits seamlessly follow them across 
    // Cellular, Wi-Fi, and VPNs, while keeping coffee shop shared-IP lockouts completely solved!
    const limitCheck = await rateLimit(`search_${userId}`);
    if (!limitCheck.success) {
      return handleRateLimitResponse(limitCheck.reset);
    }

    const validation = validateQuery(query);
    if (!validation.isValid) {
      return NextResponse.json({ 
        error: 'Query rejected', 
        message: validation.message,
        charCount: validation.charCount 
      }, { status: 400 });
    }

    // Log the search query metrics asynchronously
    await logMetric('search', query);

    // Embed search query
    const queryEmbedding = await embeddingService.getEmbedding(query);

    // Retrieve semantically matching clusters
    const results = await searchClusters(queryEmbedding, 8);

    return createResponse(results);
  } catch (error: any) {
    console.error('Error in GET /api/search:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}