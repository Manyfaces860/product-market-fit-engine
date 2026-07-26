import { NextRequest, NextResponse } from 'next/server';
import { getClusterById, getAdjacentClusters, upsertCluster, getPineconeIndex } from '@/lib/pinecone';
import { embeddingService } from '@/lib/ai';
import { auth } from '@clerk/nextjs/server';
import { logMetric } from '@/lib/mongodb';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Fetch target cluster details
    const cluster = await getClusterById(id);
    if (!cluster) {
      return NextResponse.json({ error: 'Not Found', message: `Cluster with ID ${id} not found.` }, { status: 404 });
    }

    // Fetch related / adjacent clusters in vector space
    const adjacent = await getAdjacentClusters(id, 4);

    return NextResponse.json({
      cluster,
      adjacent,
    });
  } catch (error: any) {
    console.error('Error in GET /api/clusters/[id]:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}

/**
 * PATCH handler for the "Me Too" action.
 * Increments memberCount and appends optional custom variant phrasing.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be signed in to support a problem.' }, { status: 401 });
    }

    const body = await req.json();
    const { phrasing } = body;

    // Log the Me Too metrics asynchronously
    await logMetric('me-too', phrasing || '');

    // Fetch cluster
    const cluster = await getClusterById(id);
    if (!cluster) {
      return NextResponse.json({ error: 'Not Found', message: `Cluster with ID ${id} not found.` }, { status: 404 });
    }

    // Check if the user has already supported this cluster
    const userIds = cluster.userIds || [];
    if (userIds.includes(userId)) {
      return NextResponse.json({ 
        error: 'Conflict', 
        message: 'You have already added your voice to this problem group!' 
      }, { status: 409 });
    }

    const updatedVariants = [...cluster.sampleVariants];
    if (phrasing && phrasing.trim() !== '') {
      const cleanPhrasing = phrasing.trim();
      if (!updatedVariants.includes(cleanPhrasing) && updatedVariants.length < 8) {
        updatedVariants.push(cleanPhrasing);
      }
    }

    const updatedCluster = {
      ...cluster,
      memberCount: cluster.memberCount + 1,
      sampleVariants: updatedVariants,
      lastUpdatedAt: new Date().toISOString(),
      userIds: [...userIds, userId],
    };

    // Re-get the centroid vector by re-embedding canonical text
    const centroidEmbedding = await embeddingService.getEmbedding(cluster.canonicalText);
    await upsertCluster(updatedCluster, centroidEmbedding);

    return NextResponse.json({
      success: true,
      cluster: updatedCluster,
    });
  } catch (error: any) {
    console.error(`Error applying PATCH to cluster ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
