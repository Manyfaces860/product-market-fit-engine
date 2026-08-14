import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/clerk-server';
import { logMetric, getDb, getClusterById, getAdjacentClusters } from '@/lib/mongodb';
import { createResponse } from '@/lib/response';

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

    return createResponse({
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

    // Connect to MongoDB to apply atomic transactional updates to dynamic cluster state
    const db = await getDb();
    
    // Check if the dynamic document already exists in MongoDB
    const mongoCluster = await db.collection('clusters').findOne({ id });
    let appendedPhrasing = false;
    const cleanPhrasing = (phrasing && phrasing.trim() !== '') ? phrasing.trim() : null;

    if (!mongoCluster) {
      // 🚀 Self-Healing Migration: If the cluster only exists in Pinecone, create the MongoDB record 
      // utilizing the legacy metadata values, and append the new co-signing user!
      const initialVariants = [...cluster.sampleVariants];
      if (cleanPhrasing && !initialVariants.includes(cleanPhrasing)) {
        initialVariants.push(cleanPhrasing);
        appendedPhrasing = true;
      }

      await db.collection('clusters').insertOne({
        id,
        memberCount: cluster.memberCount + 1,
        sampleVariants: initialVariants,
        userIds: [userId],
        createdAt: cluster.createdAt || new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
      });
    } else {
      // Construct the atomic update object
      const updateOps: any = {
        $inc: { memberCount: 1 },
        $push: { userIds: userId },
        $set: { lastUpdatedAt: new Date().toISOString() }
      };

      // Uncapped variants! We simply push the new variant into MongoDB if it's unique.
      if (cleanPhrasing) {
        if (!cluster.sampleVariants.includes(cleanPhrasing)) {
          if (!updateOps.$push) updateOps.$push = {};
          updateOps.$push.sampleVariants = cleanPhrasing;
          appendedPhrasing = true;
        }
      }

      // Apply ultra-fast MongoDB update (0 OpenAI embedding cost! 🚀)
      await db.collection('clusters').updateOne(
        { id },
        updateOps
      );
    }

    const updatedCluster = {
      ...cluster,
      memberCount: cluster.memberCount + 1,
      userIds: [...userIds, userId],
      sampleVariants: appendedPhrasing ? [...cluster.sampleVariants, cleanPhrasing!] : cluster.sampleVariants,
      lastUpdatedAt: new Date().toISOString(),
    };

    return createResponse({
      success: true,
      cluster: updatedCluster,
    });
  } catch (error: any) {
    console.error(`Error applying PATCH to cluster ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
