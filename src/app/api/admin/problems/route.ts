import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getProblemsByClusterId } from '@/lib/mongodb';

/**
 * GET /api/admin/problems
 * Retrieves all raw user complaints (problems) associated with a specific cluster.
 * Strictly protected for Admin role.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate & Verify Admin Role
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'You must be signed in.' }, { status: 401 });
    }

    const user = await currentUser();
    const role = (user?.publicMetadata?.role as string) || 'user';
    
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Unauthorized. This is an administrator-only endpoint.' },
        { status: 403 }
      );
    }

    // 2. Fetch parameters
    const { searchParams } = new URL(req.url);
    const clusterId = searchParams.get('clusterId');
    console.log(clusterId)

    if (!clusterId) {
      return NextResponse.json({ error: 'Validation Error', message: 'clusterId query parameter is required.' }, { status: 400 });
    }

    // 3. Query problems
    const problems = await getProblemsByClusterId(clusterId);
    
    // Sort by createdAt descending
    problems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      problems,
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/problems:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
