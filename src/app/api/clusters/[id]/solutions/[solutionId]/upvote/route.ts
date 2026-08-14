import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/clerk-server';
import { getClusterById, getDb } from '@/lib/mongodb';

/**
 * POST /api/clusters/[id]/solutions/[solutionId]/upvote
 * Unified voting endpoint supporting Reddit-style toggle upvoting, downvoting, and vote removals!
 * Expects { voteType: 'up' | 'down' } inside the request body. Defaults to 'up' for backward compatibility.
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

    // 2. Parse request body to check voteType
    const body = await req.json().catch(() => ({}));
    const voteType = body.voteType || 'up'; // Defaults to 'up'

    if (voteType !== 'up' && voteType !== 'down') {
      return NextResponse.json(
        { error: 'Validation Error', message: 'voteType must be either "up" or "down".' },
        { status: 400 }
      );
    }

    // 3. Connect to MongoDB and fetch solution details
    const db = await getDb();
    const solution = await db.collection('solutions').findOne({ id: solutionId });

    if (!solution) {
      return NextResponse.json(
        { error: 'Not Found', message: `Solution with ID ${solutionId} not found.` },
        { status: 404 }
      );
    }

    const votesUserIds = solution.votesUserIds || [];
    const downvotedUserIds = solution.downvotedUserIds || [];

    const hasUpvoted = votesUserIds.includes(userId);
    const hasDownvoted = downvotedUserIds.includes(userId);

    let upvoteChange = 0;
    const pullOps: any = {};
    const pushOps: any = {};

    // Reddit-style vote transition and toggle algebra:
    if (voteType === 'up') {
      if (hasUpvoted) {
        // 🚀 TOGGLE: Clicked UP on an already upvoted item. Remove the upvote!
        upvoteChange = -1;
        pullOps.votesUserIds = userId;
      } else {
        // Add upvote
        upvoteChange = 1;
        pushOps.votesUserIds = userId;
        
        // If they had previously downvoted, pull them from downvoters list (+1 to remove down, +1 to add up)
        if (hasDownvoted) {
          upvoteChange = 2;
          pullOps.downvotedUserIds = userId;
        }
      }
    } else { // voteType === 'down'
      if (hasDownvoted) {
        // 🚀 TOGGLE: Clicked DOWN on an already downvoted item. Remove the downvote!
        upvoteChange = 1;
        pullOps.downvotedUserIds = userId;
      } else {
        // Add downvote
        upvoteChange = -1;
        pushOps.downvotedUserIds = userId;

        // If they had previously upvoted, pull them from upvoters list (-1 to remove up, -1 to add down)
        if (hasUpvoted) {
          upvoteChange = -2;
          pullOps.votesUserIds = userId;
        }
      }
    }

    // 4. Construct and execute the atomic MongoDB update
    const updateQuery: any = {
      $inc: { upvotes: upvoteChange }
    };
    if (Object.keys(pullOps).length > 0) updateQuery.$pull = pullOps;
    if (Object.keys(pushOps).length > 0) updateQuery.$push = pushOps;

    await db.collection('solutions').updateOne(
      { id: solutionId },
      updateQuery
    );

    // 5. Fetch updated cluster (The mongo utility dynamically joins solutions)
    const cluster = await getClusterById(id);

    // 6. Assemble the local updated representation for instant frontend return state
    let nextUpvotes = [...votesUserIds];
    let nextDownvotes = [...downvotedUserIds];

    if (voteType === 'up') {
      if (hasUpvoted) {
        nextUpvotes = votesUserIds.filter((uId: string) => uId !== userId);
      } else {
        nextUpvotes = [...votesUserIds, userId];
        nextDownvotes = downvotedUserIds.filter((uId: string) => uId !== userId);
      }
    } else {
      if (hasDownvoted) {
        nextDownvotes = downvotedUserIds.filter((uId: string) => uId !== userId);
      } else {
        nextDownvotes = [...downvotedUserIds, userId];
        nextUpvotes = votesUserIds.filter((uId: string) => uId !== userId);
      }
    }

    const updatedSolution = {
      ...solution,
      upvotes: (solution.upvotes || 0) + upvoteChange,
      votesUserIds: nextUpvotes,
      downvotedUserIds: nextDownvotes,
    };

    return NextResponse.json({
      success: true,
      cluster,
      solution: updatedSolution,
    });
  } catch (error: any) {
    console.error(`Error voting on solution ${solutionId} in cluster ${id}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}