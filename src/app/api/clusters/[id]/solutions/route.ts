import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getClusterById, upsertCluster } from '@/lib/pinecone';
import { embeddingService } from '@/lib/ai';
import { Solution } from '@/lib/pinecone';

/**
 * POST /api/clusters/[id]/solutions
 * Allows an authenticated builder/founder to submit their software or hardware product as a solution to this problem cluster.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be signed in to publish a solution.' },
        { status: 401 }
      );
    }

    // Get current Clerk user for their name if builderName isn't provided
    const user = await currentUser();
    const defaultBuilderName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Anonymous Builder';

    // 2. Parse and validate body
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

    // 4. Enforce One-Solution-Per-User Constraint
    const existingSolutions = cluster.solutions || [];
    const userHasSolution = existingSolutions.some(s => s.builderId === userId);
    if (userHasSolution) {
      return NextResponse.json(
        { error: 'Conflict', message: 'You have already listed a solution for this problem! You can edit or delete your existing listing instead.' },
        { status: 409 }
      );
    }

    // 5. Check if the product URL is already listed to prevent duplicate links
    const normalizedUrl = url.trim().toLowerCase().replace(/\/$/, '');
    const isDuplicate = existingSolutions.some(s => s.url.trim().toLowerCase().replace(/\/$/, '') === normalizedUrl);
    if (isDuplicate) {
      return NextResponse.json(
        { error: 'Conflict', message: 'This product link is already listed as a solution for this problem!' },
        { status: 409 }
      );
    }

    // 6. Build Solution Record
    const newSolution: Solution = {
      id: `sol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      url: url.trim(),
      description: description.trim(),
      builderId: userId,
      builderName: (builderName && builderName.trim() !== '') ? builderName.trim() : defaultBuilderName,
      upvotes: 1,
      votesUserIds: [userId], // Creator automatically upvotes
      createdAt: new Date().toISOString(),
      iconUrl: (iconUrl && iconUrl.trim() !== '') ? iconUrl.trim() : '/placeholder-solution-icon.png',
    };

    // 6. Update cluster with the nested solution
    const updatedCluster = {
      ...cluster,
      solutions: [...existingSolutions, newSolution],
      lastUpdatedAt: new Date().toISOString(),
    };

    // Re-get the centroid vector by re-embedding canonical text
    const centroidEmbedding = await embeddingService.getEmbedding(cluster.canonicalText);
    await upsertCluster(updatedCluster, centroidEmbedding);

    return NextResponse.json({
      success: true,
      cluster: updatedCluster,
      solution: newSolution,
    });
  } catch (error: any) {
    console.error(`Error adding solution to cluster ${id}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
