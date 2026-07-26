import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getProblemById, getClusterById, upsertCluster, insertProblem } from '@/lib/pinecone';
import { embeddingService } from '@/lib/ai';

/**
 * POST /api/admin/reassign
 * Allows administrators to manually reassign a raw user problem from one cluster
 * to another to curate data quality and rectify similarity matching errors.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate & Verify Admin Role
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be signed in.' }, { status: 401 });
    }

    const user = await currentUser();
    const role = (user?.publicMetadata?.role as string) || 'user';
    
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Unauthorized. This is an administrator-only endpoint.' },
        { status: 403 }
      );
    }

    // 2. Parse body
    const body = await req.json();
    const { problemId, sourceClusterId, targetClusterId } = body;

    if (!problemId || !sourceClusterId || !targetClusterId) {
      return NextResponse.json(
        { error: 'Validation Error', message: 'problemId, sourceClusterId, and targetClusterId are all required.' },
        { status: 400 }
      );
    }

    if (sourceClusterId === targetClusterId) {
      return NextResponse.json(
        { error: 'Validation Error', message: 'Source and Target clusters cannot be the same.' },
        { status: 400 }
      );
    }

    // 3. Fetch Problem Record with its Embedding Vector
    const problemData = await getProblemById(problemId);
    if (!problemData) {
      return NextResponse.json(
        { error: 'Not Found', message: `Problem with ID ${problemId} not found.` },
        { status: 404 }
      );
    }
    const { record: problem, embedding: problemEmbedding } = problemData;

    // 4. Fetch Source and Target Clusters
    const sourceCluster = await getClusterById(sourceClusterId);
    const targetCluster = await getClusterById(targetClusterId);

    if (!sourceCluster) {
      return NextResponse.json(
        { error: 'Not Found', message: `Source cluster with ID ${sourceClusterId} not found.` },
        { status: 404 }
      );
    }
    if (!targetCluster) {
      return NextResponse.json(
        { error: 'Not Found', message: `Target cluster with ID ${targetClusterId} not found.` },
        { status: 404 }
      );
    }

    const rawText = problem.rawText;

    // 5. UPDATE SOURCE CLUSTER (Decrement)
    // Filter out the raw text from variants list
    const updatedSourceVariants = (sourceCluster.sampleVariants || []).filter(v => v !== rawText);
    const updatedSourceCluster = {
      ...sourceCluster,
      memberCount: Math.max(0, sourceCluster.memberCount - 1),
      sampleVariants: updatedSourceVariants,
      lastUpdatedAt: new Date().toISOString(),
    };
    
    const sourceEmbedding = await embeddingService.getEmbedding(sourceCluster.canonicalText);
    await upsertCluster(updatedSourceCluster, sourceEmbedding);

    // 6. UPDATE TARGET CLUSTER (Increment)
    // Append raw text to target variants if under the cap
    const updatedTargetVariants = [...(targetCluster.sampleVariants || [])];
    if (!updatedTargetVariants.includes(rawText) && updatedTargetVariants.length < 8) {
      updatedTargetVariants.push(rawText);
    }

    const updatedTargetCluster = {
      ...targetCluster,
      memberCount: targetCluster.memberCount + 1,
      sampleVariants: updatedTargetVariants,
      lastUpdatedAt: new Date().toISOString(),
    };

    const targetEmbedding = await embeddingService.getEmbedding(targetCluster.canonicalText);
    await upsertCluster(updatedTargetCluster, targetEmbedding);

    // 7. UPDATE THE PROBLEM'S METADATA (Move parent link)
    const updatedProblem = {
      ...problem,
      clusterId: targetClusterId,
      category: targetCluster.category, // Align categories
    };
    await insertProblem(updatedProblem, problemEmbedding);

    return NextResponse.json({
      success: true,
      message: 'Problem successfully reassigned.',
      sourceCluster: updatedSourceCluster,
      targetCluster: updatedTargetCluster,
      problem: updatedProblem,
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/reassign:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
