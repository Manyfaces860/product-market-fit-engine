import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getDb } from '@/lib/mongodb';
import { getClusterById } from '@/lib/pinecone';

/**
 * GET /api/clusters/[id]/solutions/[solutionId]/reviews
 * Fetches all user reviews and feedback submitted for a specific product solution.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; solutionId: string }> }
) {
  const { id, solutionId } = await params;
  try {
    const db = await getDb();
    
    // Fetch all reviews belonging to this solution
    const reviews = await db
      .collection('reviews')
      .find({ clusterId: id, solutionId })
      .toArray();

    // Sort newest first
    reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      reviews,
    });
  } catch (error: any) {
    console.error(`Error fetching reviews for solution ${solutionId}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clusters/[id]/solutions/[solutionId]/reviews
 * Allows an authenticated user to submit their review/experience for a listed solution.
 * Enforces a strict "one review per user per solution" constraint.
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
        { error: 'Unauthorized', message: 'You must be signed in to post a review.' },
        { status: 401 }
      );
    }

    // Get current Clerk user's name as a fallback
    const user = await currentUser();
    const defaultUserName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Anonymous User';

    // 2. Parse and validate body
    const body = await req.json();
    const { rating, text, userName } = body;

    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return NextResponse.json(
        { error: 'Validation Error', message: 'Rating must be a valid number between 1 and 5.' },
        { status: 400 }
      );
    }
    if (!text || text.trim() === '') {
      return NextResponse.json(
        { error: 'Validation Error', message: 'Review feedback comment text cannot be empty.' },
        { status: 400 }
      );
    }

    // 3. Verify the cluster and solution actually exist (Referential integrity)
    const cluster = await getClusterById(id);
    if (!cluster) {
      return NextResponse.json({ error: 'Not Found', message: 'Problem group not found.' }, { status: 404 });
    }
    const solutions = cluster.solutions || [];
    const solutionExists = solutions.some(s => s.id === solutionId);
    if (!solutionExists) {
      return NextResponse.json({ error: 'Not Found', message: 'Listed solution product not found.' }, { status: 404 });
    }

    // 4. Connect to MongoDB and enforce the ONE-REVIEW-PER-USER constraint
    const db = await getDb();
    const existingReview = await db.collection('reviews').findOne({ solutionId, userId });
    
    if (existingReview) {
      return NextResponse.json(
        { 
          error: 'Conflict', 
          message: 'You have already submitted your review for this product solution! Multiple reviews per user are not allowed.' 
        },
        { status: 409 }
      );
    }

    // 5. Build and insert Review record
    const newReview = {
      clusterId: id,
      solutionId,
      userId,
      userName: (userName && userName.trim() !== '') ? userName.trim() : defaultUserName,
      rating: numericRating,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    const result = await db.collection('reviews').insertOne(newReview);

    return NextResponse.json({
      success: true,
      review: {
        _id: result.insertedId,
        ...newReview,
      },
    });
  } catch (error: any) {
    console.error(`Error posting review for solution ${solutionId}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
