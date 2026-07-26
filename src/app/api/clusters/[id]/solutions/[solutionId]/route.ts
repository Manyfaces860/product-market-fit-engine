import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getClusterById, upsertCluster } from '@/lib/pinecone';
import { embeddingService } from '@/lib/ai';

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

    // 3. Fetch cluster
    const cluster = await getClusterById(id);
    if (!cluster) {
      return NextResponse.json(
        { error: 'Not Found', message: `Problem group with ID ${id} not found.` },
        { status: 404 }
      );
    }

    // 4. Find the target solution
    const solutions = cluster.solutions || [];
    const solutionIndex = solutions.findIndex(s => s.id === solutionId);

    if (solutionIndex === -1) {
      return NextResponse.json(
        { error: 'Not Found', message: `Solution with ID ${solutionId} not found.` },
        { status: 404 }
      );
    }

    const solution = solutions[solutionIndex];

    // 5. Authorization Guard: Check if user is the builder
    if (solution.builderId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You are not authorized to modify this solution.' },
        { status: 403 }
      );
    }

    // 6. Check for duplicate URL with other products in the same cluster
    const normalizedUrl = url.trim().toLowerCase().replace(/\/$/, '');
    const isDuplicate = solutions.some(
      (s, idx) => idx !== solutionIndex && s.url.trim().toLowerCase().replace(/\/$/, '') === normalizedUrl
    );
    if (isDuplicate) {
      return NextResponse.json(
        { error: 'Conflict', message: 'Another listed product is already using this link!' },
        { status: 409 }
      );
    }

    // 7. Apply updates while preserving system fields (ID, builderId, upvotes, votesUserIds, createdAt)
    const updatedSolution = {
      ...solution,
      name: name.trim(),
      url: url.trim(),
      description: description.trim(),
      builderName: (builderName && builderName.trim() !== '') ? builderName.trim() : solution.builderName,
      iconUrl: (iconUrl && iconUrl.trim() !== '') ? iconUrl.trim() : '/placeholder-solution-icon.png',
      lastUpdatedAt: new Date().toISOString(),
    };

    const updatedSolutions = [...solutions];
    updatedSolutions[solutionIndex] = updatedSolution;

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

    // 2. Fetch cluster
    const cluster = await getClusterById(id);
    if (!cluster) {
      return NextResponse.json(
        { error: 'Not Found', message: `Problem group with ID ${id} not found.` },
        { status: 404 }
      );
    }

    // 3. Find target solution to verify ownership
    const solutions = cluster.solutions || [];
    const solution = solutions.find(s => s.id === solutionId);

    if (!solution) {
      return NextResponse.json(
        { error: 'Not Found', message: `Solution with ID ${solutionId} not found.` },
        { status: 404 }
      );
    }

    // 4. Authorization Guard: Check if user is the builder of the solution
    if (solution.builderId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You are not authorized to delete this solution.' },
        { status: 403 }
      );
    }

    // 5. Remove solution from list
    const updatedSolutions = solutions.filter(s => s.id !== solutionId);

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
    });
  } catch (error: any) {
    console.error(`Error deleting solution ${solutionId} from cluster ${id}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
