import { NextRequest, NextResponse } from 'next/server';
import { embeddingService } from '@/lib/ai';
import { searchClusters } from '@/lib/pinecone';
import { validateQuery } from '@/lib/validation';
import { rateLimit, handleRateLimitResponse } from '@/lib/rate-limit';
import { logMetric } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';

    // Rate limiting (IP-based for search so anonymous users can search)
    const ip = req.headers.get('x-forwarded-for') || 'anonymous_search';
    const limitCheck = await rateLimit(`search_${ip}`);
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

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error in GET /api/search:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
