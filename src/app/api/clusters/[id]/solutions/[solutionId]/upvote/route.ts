import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClusterById } from '@/lib/pinecone';
import { getDb } from '@/lib/mongodb';

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

    // 2. Connect to MongoDB and fetch solution details
    const db = await getDb();
    const solution = await db.collection('solutions').findOne({ id: solutionId });

    if (!solution) {
      return NextResponse.json(
        { error: 'Not Found', message: `Solution with ID ${solutionId} not found.` },
        { status: 404 }
      );
    }

    const votesUserIds = solution.votesUserIds || [];

    // 3. Check for duplicate upvotes
    if (votesUserIds.includes(userId)) {
      return NextResponse.json(
        { error: 'Conflict', message: 'You have already upvoted this solution!' },
        { status: 409 }
      );
    }

    // 4. Apply upvote atomically in MongoDB 🚀
    await db.collection('solutions').updateOne(
      { id: solutionId },
      {
        $inc: { upvotes: 1 },
        $push: { votesUserIds: userId }
      }
    );

    // 5. Fetch updated cluster (The pinecone utility dynamically joins the freshly updated solution from MongoDB!)
    const cluster = await getClusterById(id);

    // Construct updated solution representation for instantaneous frontend return state
    const updatedSolution = {
      ...solution,
      upvotes: (solution.upvotes || 0) + 1,
      votesUserIds: [...votesUserIds, userId],
    };

    return NextResponse.json({
      success: true,
      cluster,
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