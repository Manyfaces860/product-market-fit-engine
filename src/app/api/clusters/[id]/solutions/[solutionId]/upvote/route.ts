import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClusterById, upsertCluster } from '@/lib/pinecone';
import { embeddingService } from '@/lib/ai';

/**
 * POST /api/clusters/[id]/solutions/[solutionId]/upvote
 * Allows authenticated users to upvote a solution (prevents multiple upvotes from the same user).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; solutionId: string }> }
) {
  const { id, solutionId } = await params;
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be signed in to rate a solution.' },
        { status: 401 }
      );
    }

    // 2. Fetch cluster
    const cluster = await getClusterById(id);
    if (!cluster) {
      return NextResponse.json(
        { error: 'Not Found', message: `Problem group with ID ${id} not found.` },
        { status: 404 }
      );
    }

    // 3. Find and update the specific solution
    const solutions = cluster.solutions || [];
    const solutionIndex = solutions.findIndex(s => s.id === solutionId);

    if (solutionIndex === -1) {
      return NextResponse.json(
        { error: 'Not Found', message: `Solution with ID ${solutionId} not found.` },
        { status: 404 }
      );
    }

    const solution = solutions[solutionIndex];
    const votesUserIds = solution.votesUserIds || [];

    // 4. Check for duplicate upvotes
    if (votesUserIds.includes(userId)) {
      return NextResponse.json(
        { error: 'Conflict', message: 'You have already upvoted this solution!' },
        { status: 409 }
      );
    }

    // 5. Apply upvote & record user ID
    const updatedSolution = {
      ...solution,
      upvotes: solution.upvotes + 1,
      votesUserIds: [...votesUserIds, userId],
    };

    const updatedSolutions = [...solutions];
    updatedSolutions[solutionIndex] = updatedSolution;

    // 6. Update cluster with updated solutions list
    const updatedCluster = {
      ...cluster,
      solutions: updatedSolutions,
      lastUpdatedAt: new Date().toISOString(),
    };

    // Re-get the centroid vector by re-embedding canonical text
    const centroidEmbedding = await embeddingService.getEmbedding(cluster.canonicalText);
    await upsertCluster(updatedCluster, centroidEmbedding);

    return NextResponse.json({
      success: true,
      cluster: updatedCluster,
      solution: updatedSolution,
    });
  } catch (error: any) {
    console.error(`Error upvoting solution ${solutionId} in cluster ${id}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
