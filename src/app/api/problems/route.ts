import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { validateQuery } from '@/lib/validation';
import { rateLimit, handleRateLimitResponse } from '@/lib/rate-limit';
import { embeddingService, llmService } from '@/lib/ai';
import { 
  getClusters, 
  getCategories, 
  searchClusters, 
  upsertCluster, 
  insertProblem,
  logMetric,
  getDb
} from '@/lib/mongodb';
import { 
  MongoClusterDocument as ClusterRecord, 
  MongoProblemDocument as ProblemRecord 
} from '@/lib/models/schema';

const SIMILARITY_THRESHOLD = Number(process.env.NEXT_PUBLIC_SIMILARITY_THRESHOLD || 0.40);

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be signed in to submit a problem.' }, { status: 401 });
    }

    // 2. Robust user-based rate limiting 🛡️
    // By keying strictly on userId, the user's rate limits seamlessly follow them across 
    // Cellular, Wi-Fi, and VPNs, while keeping coffee shop shared-IP lockouts completely solved!
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
      
      // Apply fast, atomic updates to MongoDB (Uncapped variants, 0 embedding cost! 🚀)
      const existingUserIds = matchedCluster.userIds || [];
      const userAlreadyJoined = existingUserIds.includes(userId);
      
      const db = await getDb();
      const mongoCluster = await db.collection('clusters').findOne({ id: matchedCluster.id });
      let appendedVariant = false;

      if (!mongoCluster) {
        // 🚀 Self-Healing Migration: If the matched cluster exists only in Pinecone, create the MongoDB 
        // document utilizing current state (which pulls legacy values from Pinecone)
        const initialVariants = [...matchedCluster.sampleVariants];
        if (!initialVariants.includes(text)) {
          initialVariants.push(text);
          appendedVariant = true;
        }

        await db.collection('clusters').insertOne({
          id: matchedCluster.id,
          memberCount: matchedCluster.memberCount + (userAlreadyJoined ? 0 : 1),
          sampleVariants: initialVariants,
          userIds: userAlreadyJoined ? existingUserIds : [...existingUserIds, userId],
          createdAt: matchedCluster.createdAt || nowStr,
          lastUpdatedAt: nowStr,
        });
      } else {
        // Existing document update: apply fast, atomic changes
        const updateOps: any = {
          $set: { lastUpdatedAt: nowStr }
        };
        
        if (!userAlreadyJoined) {
          updateOps.$inc = { memberCount: 1 };
          updateOps.$push = { userIds: userId };
        }
        
        if (!matchedCluster.sampleVariants.includes(text)) {
          if (!updateOps.$push) updateOps.$push = {};
          updateOps.$push.sampleVariants = text;
          appendedVariant = true;
        }
        
        await db.collection('clusters').updateOne(
          { id: matchedCluster.id },
          updateOps
        );
      }

      const updatedCluster: ClusterRecord = {
        ...matchedCluster,
        memberCount: matchedCluster.memberCount + (userAlreadyJoined ? 0 : 1),
        sampleVariants: appendedVariant ? [...matchedCluster.sampleVariants, text] : matchedCluster.sampleVariants,
        lastUpdatedAt: nowStr,
        userIds: userAlreadyJoined ? existingUserIds : [...existingUserIds, userId],
      };

      // Create raw problem record in Pinecone
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

      // 1. Generate embedding for the clean canonical text (better centroid representation)
      const canonicalEmbedding = await embeddingService.getEmbedding(finalCanonicalText);
      
      // 2. Insert static taxonomy into Pinecone
      const newClusterForPinecone: ClusterRecord = {
        id: clusterId,
        category: finalCategory,
        categoryLabel: finalCategoryLabel,
        categoryDescription: finalCategoryDescription,
        canonicalText: finalCanonicalText,
        memberCount: 0, // Ignored by Pinecone now
        sampleVariants: [], // Ignored by Pinecone now
        createdAt: nowStr,
        lastUpdatedAt: nowStr,
      };
      await upsertCluster(newClusterForPinecone, canonicalEmbedding);

      // 3. Insert dynamic state into MongoDB 🚀
      const db = await getDb();
      await db.collection('clusters').insertOne({
        id: clusterId,
        memberCount: 1,
        sampleVariants: [text],
        userIds: [userId],
        createdAt: nowStr,
        lastUpdatedAt: nowStr,
      });

      // Assemble unified cluster representation for the client
      const unifiedCluster: ClusterRecord = {
        ...newClusterForPinecone,
        memberCount: 1,
        sampleVariants: [text],
        userIds: [userId],
      };

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
        cluster: unifiedCluster,
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
