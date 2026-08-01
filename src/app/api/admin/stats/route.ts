import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getDb, getClusters } from '@/lib/mongodb';

/**
 * GET /api/admin/stats
 * Strictly protected route that computes system-wide metrics and financial costs
 * for your private Admin Dashboard.
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
        { error: 'Forbidden', message: 'Unauthorized. This endpoint is strictly reserved for Administrators.' },
        { status: 403 }
      );
    }

    // 2. Fetch database data
    const db = await getDb();
    const clusters = await getClusters();
    
    // Pinecone Stats
    const totalClustersCount = clusters.length;
    const categoryPopularity: Record<string, number> = {};

    for (const c of clusters) {
      categoryPopularity[c.categoryLabel] = (categoryPopularity[c.categoryLabel] || 0) + c.memberCount;
    }

    // MongoDB Solutions Count 🚀
    const totalSolutionsCount = db.collection('solutions').countDocuments 
      ? await db.collection('solutions').countDocuments() 
      : (await db.collection('solutions').find({}).toArray()).length;

    // MongoDB Reviews Count
    const totalReviewsCount = await db.collection('reviews').countDocuments ? await db.collection('reviews').countDocuments() : (await db.collection('reviews').find({}).toArray()).length;

    // MongoDB Performance & AI Cost Metrics
    const metricsCursor = await db.collection('metrics').find({});
    const metricsList = await metricsCursor.toArray();

    const totalTransactions = metricsList.length;
    let totalCostEstimated = 0;
    let submissionCharSum = 0;
    let submissionWordSum = 0;
    let submissionCount = 0;

    const costsByType: Record<string, number> = {
      submission: 0,
      search: 0,
      'me-too': 0,
    };

    const countsByType: Record<string, number> = {
      submission: 0,
      search: 0,
      'me-too': 0,
    };

    for (const m of metricsList) {
      totalCostEstimated += Number(m.estimatedCost || 0);
      costsByType[m.type] = (costsByType[m.type] || 0) + Number(m.estimatedCost || 0);
      countsByType[m.type] = (countsByType[m.type] || 0) + 1;

      if (m.type === 'submission') {
        submissionCharSum += Number(m.charCount || 0);
        submissionWordSum += Number(m.wordCount || 0);
        submissionCount++;
      }
    }

    const avgProblemCharCount = submissionCount > 0 ? Math.round(submissionCharSum / submissionCount) : 0;
    const avgProblemWordCount = submissionCount > 0 ? Math.round(submissionWordSum / submissionCount) : 0;
    const avgCostPerSubmission = submissionCount > 0 ? (costsByType.submission / submissionCount) : 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalClustersCount,
        totalSolutionsCount,
        totalReviewsCount,
        totalTransactions,
        totalCostEstimated: Number(totalCostEstimated.toFixed(4)),
        avgProblemCharCount,
        avgProblemWordCount,
        avgProblemTokenCount: Math.round(avgProblemCharCount / 4),
        avgCostPerSubmission: Number(avgCostPerSubmission.toFixed(5)),
        costsByType: {
          submission: Number((costsByType.submission || 0).toFixed(4)),
          search: Number((costsByType.search || 0).toFixed(4)),
          'me-too': Number((costsByType['me-too'] || 0).toFixed(4)),
        },
        countsByType: {
          submission: countsByType.submission || 0,
          search: countsByType.search || 0,
          'me-too': countsByType['me-too'] || 0,
        },
        categoryPopularity,
      },
    });
  } catch (error: any) {
    console.error('Error computing Admin stats:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
