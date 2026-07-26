import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { validateQuery } from '@/lib/validation';
import { rateLimit, handleRateLimitResponse } from '@/lib/rate-limit';
import { embeddingService, llmService } from '@/lib/ai';
import { logMetric } from '@/lib/mongodb';
import { 
  getClusters, 
  getCategories, 
  searchClusters, 
  upsertCluster, 
  insertProblem, 
  ClusterRecord, 
  ProblemRecord 
} from '@/lib/pinecone';

const SIMILARITY_THRESHOLD = Number(process.env.NEXT_PUBLIC_SIMILARITY_THRESHOLD || 0.40);

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be signed in to submit a problem.' }, { status: 401 });
    }

    // 2. Rate limit check (by userId)
    const limitCheck = await rateLimit(`submit_${userId}`);
    if (!limitCheck.success) {
      return handleRateLimitResponse(limitCheck.reset);
    }

    // 3. Parse and validate body
    const body = await req.json();
    const { text, draft = true, confirmedCategory, confirmedCanonicalText } = body;

    const validation = validateQuery(text);
    if (!validation.isValid) {
      // Return 400 Bad Request with character truncation notice
      return NextResponse.json({ 
        error: 'Query rejected', 
        message: validation.message,
        charCount: validation.charCount 
      }, { status: 400 });
    }

    // 4. Generate embedding for the input text
    const queryEmbedding = await embeddingService.getEmbedding(text);

    // 5. Search for nearest existing clusters
    const matches = await searchClusters(queryEmbedding, 1);
    const topMatch = matches[0];
    const isMatch = topMatch && topMatch.score !== undefined && topMatch.score >= SIMILARITY_THRESHOLD;

    // --- CASE A: DRAFT MODE ---
    // Return proposed categorization/clustering without writing anything to DB
    if (draft) {
      await logMetric('submission', text);

      if (isMatch) {
        return NextResponse.json({
          mode: 'match',
          similarity: topMatch.score,
          cluster: topMatch,
          proposedCategory: topMatch.category,
          proposedCategoryLabel: topMatch.categoryLabel,
          proposedCategoryDescription: topMatch.categoryDescription,
          proposedCanonicalText: topMatch.canonicalText,
        });
      }

      // No match - trigger LLM to suggest category and canonical description
      const existingCategories = await getCategories();
      const classification = await llmService.classifyProblem(text, existingCategories);

      if (classification.isValid === false) {
        return NextResponse.json({
          error: 'Rejected',
          message: classification.rejectionReason || 'Input rejected. Please write a meaningful, real-world, product-solvable problem.',
        }, { status: 400 });
      }

      return NextResponse.json({
        mode: 'new',
        similarity: topMatch ? topMatch.score : 0,
        proposedCategory: classification.category,
        proposedCategoryLabel: classification.categoryLabel,
        proposedCategoryDescription: classification.categoryDescription,
        proposedCanonicalText: classification.canonicalText,
      });
    }

    // --- CASE B: FINALIZE MODE (WRITE TO PINECONE) ---
    const problemId = `prob_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowStr = new Date().toISOString();

    if (isMatch) {
      // Join existing cluster
      const matchedCluster = topMatch;
      
      // Update member count and append variant text if distinct and cap at 8 items
      const updatedVariants = [...matchedCluster.sampleVariants];
      if (!updatedVariants.includes(text) && updatedVariants.length < 8) {
        updatedVariants.push(text);
      }
      
      const existingUserIds = matchedCluster.userIds || [];
      const updatedUserIds = existingUserIds.includes(userId)
        ? existingUserIds
        : [...existingUserIds, userId];

      const updatedCluster: ClusterRecord = {
        ...matchedCluster,
        memberCount: matchedCluster.memberCount + (existingUserIds.includes(userId) ? 0 : 1),
        sampleVariants: updatedVariants,
        lastUpdatedAt: nowStr,
        userIds: updatedUserIds,
      };

      // Upsert cluster back into Pinecone (re-uses existing centroid embedding)
      // Note: We search again or fetch to preserve its centroid embedding
      const rawClusterVector = await embeddingService.getEmbedding(matchedCluster.canonicalText);
      await upsertCluster(updatedCluster, rawClusterVector);

      // Create raw problem record
      const problemRecord: ProblemRecord = {
        id: problemId,
        rawText: text,
        category: matchedCluster.category,
        clusterId: matchedCluster.id,
        createdAt: nowStr,
      };
      await insertProblem(problemRecord, queryEmbedding);

      return NextResponse.json({
        success: true,
        joinedCluster: true,
        cluster: updatedCluster,
        problemId,
      });
    } else {
      // Seed a new cluster
      const clusterId = `cluster_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      const finalCategory = confirmedCategory || 'uncategorized';
      const finalCategoryLabel = body.confirmedCategoryLabel || 'General Frustrations';
      const finalCategoryDescription = body.confirmedCategoryDescription || 'Miscellaneous user submissions';
      const finalCanonicalText = confirmedCanonicalText || text;

      const newCluster: ClusterRecord = {
        id: clusterId,
        category: finalCategory,
        categoryLabel: finalCategoryLabel,
        categoryDescription: finalCategoryDescription,
        canonicalText: finalCanonicalText,
        memberCount: 1,
        sampleVariants: [text],
        createdAt: nowStr,
        lastUpdatedAt: nowStr,
        userIds: [userId],
      };

      // Generate embedding for the clean canonical text (better centroid representation)
      const canonicalEmbedding = await embeddingService.getEmbedding(finalCanonicalText);
      await upsertCluster(newCluster, canonicalEmbedding);

      // Save raw problem
      const problemRecord: ProblemRecord = {
        id: problemId,
        rawText: text,
        category: finalCategory,
        clusterId,
        createdAt: nowStr,
      };
      await insertProblem(problemRecord, queryEmbedding);

      return NextResponse.json({
        success: true,
        joinedCluster: false,
        cluster: newCluster,
        problemId,
      });
    }

  } catch (error: any) {
    console.error('Error handling problem submission:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      message: error.message || 'An error occurred during submission.' 
    }, { status: 500 });
  }
}
