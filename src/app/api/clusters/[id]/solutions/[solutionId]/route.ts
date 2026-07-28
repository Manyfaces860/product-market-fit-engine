import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClusterById } from '@/lib/pinecone';
import { getDb } from '@/lib/mongodb';

/**
 * PATCH /api/clusters/[id]/solutions/[solutionId]
 * Allows the original author (builder) to update their solution details.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; solutionId: string }> }
) {
  const { id, solutionId } = await params;
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be signed in to modify a solution.' },
        { status: 401 }
      );
    }

    // 2. Parse body
    const body = await req.json();
    const { name, url, description, builderName, iconUrl } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Validation Error', message: 'Product name is required.' }, { status: 400 });
    }
    if (!url || url.trim() === '') {
      return NextResponse.json({ error: 'Validation Error', message: 'Product URL is required.' }, { status: 400 });
    }
    if (!description || description.trim() === '') {
      return NextResponse.json({ error: 'Validation Error', message: 'Description of how it solves the problem is required.' }, { status: 400 });
    }

    // 3. Fetch cluster (This already joins solutions from MongoDB!)
    const cluster = await getClusterById(id);
    if (!cluster) {
      return NextResponse.json(
        { error: 'Not Found', message: `Problem group with ID ${id} not found.` },
        { status: 404 }
      );
    }

    // 4. Connect to MongoDB to fetch and modify the solution
    const db = await getDb();
    const solution = await db.collection('solutions').findOne({ id: solutionId });

    if (!solution) {
      return NextResponse.json(
        { error: 'Not Found', message: `Solution with ID ${solutionId} not found.` },
        { status: 404 }
      );
    }

    // 5. Authorization Guard: Check if user is the builder
    if (solution.builderId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You are not authorized to modify this solution.' },
        { status: 403 }
      );
    }

    // 6. Check for duplicate URL with other products in the same cluster
    const solutions = cluster.solutions || [];
    const normalizedUrl = url.trim().toLowerCase().replace(/\/$/, '');
    const isDuplicate = solutions.some(
      s => s.id !== solutionId && s.url.trim().toLowerCase().replace(/\/$/, '') === normalizedUrl
    );
    if (isDuplicate) {
      return NextResponse.json(
        { error: 'Conflict', message: 'Another listed product is already using this link!' },
        { status: 409 }
      );
    }

    // 7. Apply updates to MongoDB while preserving system fields (id, clusterId, builderId, upvotes, votesUserIds, createdAt)
    const updatedFields = {
      name: name.trim(),
      url: url.trim(),
      description: description.trim(),
      builderName: (builderName && builderName.trim() !== '') ? builderName.trim() : solution.builderName,
      iconUrl: (iconUrl && iconUrl.trim() !== '') ? iconUrl.trim() : '/placeholder-solution-icon.png',
      lastUpdatedAt: new Date().toISOString(),
    };

    await db.collection('solutions').updateOne(
      { id: solutionId },
      { $set: updatedFields }
    );

    // 8. Return response with the updated state
    const updatedSolution = {
      ...solution,
      ...updatedFields,
    };

    const updatedSolutions = solutions.map(s => s.id === solutionId ? updatedSolution : s);

    return NextResponse.json({
      success: true,
      cluster: {
        ...cluster,
        solutions: updatedSolutions,
      },
      solution: updatedSolution,
    });
  } catch (error: any) {
    console.error(`Error updating solution ${solutionId} in cluster ${id}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clusters/[id]/solutions/[solutionId]
 * Allows the original author (builder) to delete their listed solution from this problem cluster.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; solutionId: string }> }
) {
  const { id, solutionId } = await params;
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be signed in to delete a solution.' },
        { status: 401 }
      );
    }

    // 2. Connect to MongoDB to fetch and delete the solution
    const db = await getDb();
    const solution = await db.collection('solutions').findOne({ id: solutionId });

    if (!solution) {
      return NextResponse.json(
        { error: 'Not Found', message: `Solution with ID ${solutionId} not found.` },
        { status: 404 }
      );
    }

    // 3. Authorization Guard: Check if user is the builder of the solution
    if (solution.builderId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You are not authorized to delete this solution.' },
        { status: 403 }
      );
    }

    // 4. Fetch cluster (This already joins solutions from MongoDB!)
    const cluster = await getClusterById(id);
    if (!cluster) {
      return NextResponse.json(
        { error: 'Not Found', message: `Problem group with ID ${id} not found.` },
        { status: 404 }
      );
    }

    // 5. Delete solution from MongoDB 🚀
    await db.collection('solutions').deleteOne({ id: solutionId });

    // 6. Relational cascade: Delete associated reviews in MongoDB as well!
    await db.collection('reviews').deleteMany({ solutionId });

    // 7. Filter deleted solution out of local array to return fresh response
    const updatedSolutions = (cluster.solutions || []).filter(s => s.id !== solutionId);

    return NextResponse.json({
      success: true,
      cluster: {
        ...cluster,
        solutions: updatedSolutions,
      },
    });
  } catch (error: any) {
    console.error(`Error deleting solution ${solutionId} from cluster ${id}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}