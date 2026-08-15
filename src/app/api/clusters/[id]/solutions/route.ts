import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@/lib/clerk-server';
import { getClusterById, getDb, promoteUserToBuilder } from '@/lib/mongodb';
import { MongoSolutionDocument as Solution } from '@/lib/models/schema';
import { blastLaunchNotification } from '@/lib/resend';

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
    const { name, url, description, builderName, iconUrl, solutionId } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Validation Error', message: 'Product name is required.' }, { status: 400 });
    }
    const trimmedUrl = url ? url.trim() : '';
    if (!url || trimmedUrl === '') {
      return NextResponse.json({ error: 'Validation Error', message: 'Product URL is required.' }, { status: 400 });
    }
    // Security protocol validation to block malicious XSS links (javascript:alert etc.) 🛡️
    const isSafeUrl = trimmedUrl.toLowerCase().startsWith('http://') || trimmedUrl.toLowerCase().startsWith('https://');
    if (!isSafeUrl) {
      return NextResponse.json(
        { error: 'Validation Error', message: 'Product URL must use a safe web protocol (http:// or https://).' },
        { status: 400 }
      );
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

    const existingSolutions = cluster.solutions || [];

    // CHECK IDEMPOTENCY KEY: If solution with this client-generated ID already exists, short-circuit immediately
    // Prevents double-submissions, duplicate writes, and double email blasts during network retries.
    if (solutionId) {
      const alreadyProcessed = existingSolutions.find((s: any) => s.id === solutionId);
      if (alreadyProcessed) {
        console.log(`[Idempotency] Duplicate request caught for solutionId: ${solutionId}. Silently returning success.`);
        return NextResponse.json({
          success: true,
          cluster,
          solution: alreadyProcessed,
        });
      }
    }

    // 4. Enforce One-Solution-Per-User Constraint
    const userHasSolution = existingSolutions.some((s: any) => s.builderId === userId);
    if (userHasSolution) {
      return NextResponse.json(
        { error: 'Conflict', message: 'You have already listed a solution for this problem! You can edit or delete your existing listing instead.' },
        { status: 409 }
      );
    }

    // 5. Check if the product URL is already listed to prevent duplicate links
    const normalizedUrl = url.trim().toLowerCase().replace(/\/$/, '');
    const isDuplicate = existingSolutions.some((s: any) => s.url.trim().toLowerCase().replace(/\/$/, '') === normalizedUrl);
    if (isDuplicate) {
      return NextResponse.json(
        { error: 'Conflict', message: 'This product link is already listed as a solution for this problem!' },
        { status: 409 }
      );
    }

    // 6. Build Solution Record
    const newSolution = {
      id: solutionId || `sol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      clusterId: id, // 🚀 Relational key back to the cluster/problem group
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

    // 6. Persist directly to MongoDB 🚀
    const db = await getDb();
    await db.collection('solutions').insertOne(newSolution);

    // 6.5 Promote user to Builder in MongoDB users collection! 🚀
    await promoteUserToBuilder(userId);

    // 7. Dispatch automated launch notifications to co-signers in the background
    // Running this in the background guarantees an instantaneous HTTP 200 response for the Builder!
    const coSigners = cluster.userIds || [];
    if (coSigners.length > 0) {
      console.log(`[Notification] Backgrounding email blast for ${coSigners.length} co-signers...`);
      blastLaunchNotification(
        coSigners,
        cluster.canonicalText,
        newSolution.name,
        id
      ).catch(err => console.error('[Notification] Background email blast failed:', err));
    }

    return NextResponse.json({
      success: true,
      cluster: {
        ...cluster,
        solutions: [...existingSolutions, newSolution],
      },
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
