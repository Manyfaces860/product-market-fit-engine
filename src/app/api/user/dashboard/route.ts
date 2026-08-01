import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getDb, getUserByClerkId, upsertUser } from '@/lib/mongodb';
import { ROLE_PERKS_CONFIG } from '@/lib/config/perks';

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be signed in to view your dashboard.' },
        { status: 401 }
      );
    }

    // 2. Fetch or auto-initialize User Profile Document (Self-Healing!) 👤
    let userProfile = await getUserByClerkId(userId);
    const nowStr = new Date().toISOString();

    if (!userProfile) {
      const clerkUser = await currentUser();
      const name = clerkUser ? `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() : 'Anonymous Member';
      const email = clerkUser?.emailAddresses[0]?.emailAddress || 'anonymous@p-x1.dev';
      
      userProfile = {
        userId,
        email,
        name,
        role: 'reporter', // Default starting role
        createdAt: nowStr
      };
      
      await upsertUser(userProfile);
      console.log(`[DashboardAPI] Profile auto-initialized for user: ${userId}`);
    }

    const db = await getDb();

    // 3. Query general Community Reporter metrics
    // Fetch all raw problem complaints submitted by this user
    const myProblemsPromise = db.collection('problems')
      .find({ userId }, { projection: { embedding: 0 } })
      .toArray();

    // Fetch all problem clusters where this user co-signed "Me Too"
    const mySupportedClustersPromise = db.collection('clusters')
      .find({ userIds: userId }, { projection: { embedding: 0, userIds: 0 } })
      .toArray();

    const [myProblems, mySupportedClusters] = await Promise.all([
      myProblemsPromise,
      mySupportedClustersPromise
    ]);

    // Clean MongoDB _id references
    const cleanProblems = myProblems.map((p: any) => {
      delete p._id;
      return p;
    });

    const cleanSupportedClusters = mySupportedClusters.map((c: any) => {
      delete c._id;
      c.variantCount = typeof c.variantCount === 'number' ? c.variantCount : (c.sampleVariants?.length || 0);
      return c;
    });

    // 4. Query Builder-specific metrics (Only if elevated to Builder or Admin!) ⚡
    let builderSolutions: any[] = [];
    let builderReviews: any[] = [];
    let totalProductsCount = 0;
    let totalUpvotesScore = 0;

    if (userProfile.role === 'builder' || userProfile.role === 'admin') {
      // Fetch solutions listed by this builder
      const solutions = await db.collection('solutions')
        .find({ builderId: userId })
        .toArray();

      totalProductsCount = solutions.length;
      
      if (solutions.length > 0) {
        const solutionIds = solutions.map((s: any) => s.id);
        
        // Fetch all reviews matching any of this builder's product IDs
        const reviews = await db.collection('reviews')
          .find({ solutionId: { $in: solutionIds } })
          .toArray();

        builderReviews = reviews.map((r: any) => {
          delete r._id;
          return r;
        });

        builderSolutions = solutions.map((sol: any) => {
          delete sol._id;
          totalUpvotesScore += Number(sol.upvotes || 0);
          
          // Filter matching reviews for this product
          const solReviews = builderReviews.filter((r: any) => r.solutionId === sol.id);
          const avgRating = solReviews.length > 0 
            ? Number((solReviews.reduce((acc, r) => acc + r.rating, 0) / solReviews.length).toFixed(1))
            : 0;

          return {
            ...sol,
            reviewsCount: solReviews.length,
            averageRating: avgRating
          };
        });
      }
    }

    // 5. Package and return the payload with their role-perks configuration
    const perks = ROLE_PERKS_CONFIG[userProfile.role] || ROLE_PERKS_CONFIG.reporter;

    return NextResponse.json({
      success: true,
      profile: userProfile,
      perks,
      reporter: {
        problems: cleanProblems,
        supportedClusters: cleanSupportedClusters,
        totalComplaintsCount: cleanProblems.length,
        totalSupportedCount: cleanSupportedClusters.length
      },
      builder: {
        solutions: builderSolutions,
        reviews: builderReviews,
        totalProductsCount,
        totalUpvotesScore
      }
    });

  } catch (error: any) {
    console.error('[DashboardAPI] Error generating dashboard data payload:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message || 'Unable to retrieve dashboard state.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/dashboard
 * Allows builders/founders to save custom profile customizations (customBio, githubUrl, websiteUrl).
 */
export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be signed in to modify your profile.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { customBio, githubUrl, websiteUrl } = body;

    // Verify user is allowed to save portfolio items
    const userProfile = await getUserByClerkId(userId);
    if (!userProfile) {
      return NextResponse.json(
        { error: 'Not Found', message: 'User profile not found. Please load the dashboard once to initialize.' },
        { status: 404 }
      );
    }

    const perks = ROLE_PERKS_CONFIG[userProfile.role];
    if (!perks || !perks.customLinksEnabled) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Portfolio features are locked. Submit a product solution to promote your account and unlock custom links!' },
        { status: 403 }
      );
    }

    // Sanitization and XSS protocol validation
    const sanitizeLink = (urlStr: string): string => {
      if (!urlStr || urlStr.trim() === '') return '';
      const trimmed = urlStr.trim();
      const isWeb = trimmed.toLowerCase().startsWith('http://') || trimmed.toLowerCase().startsWith('https://');
      return isWeb ? trimmed : `https://${trimmed}`;
    };

    const updateFields: any = {};
    if (customBio && typeof customBio === 'string') {
      updateFields.customBio = customBio.trim().substring(0, 160); // Cap bio at 160 chars
    }
    if (githubUrl && typeof githubUrl === 'string') {
      updateFields.githubUrl = sanitizeLink(githubUrl);
    }
    if (websiteUrl && typeof websiteUrl === 'string') {
      updateFields.websiteUrl = sanitizeLink(websiteUrl);
    }

    const db = await getDb();
    await db.collection('users').updateOne(
      { userId },
      { $set: updateFields }
    );

    console.log(`[DashboardAPI] Profile details updated for user: ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Your Builder Profile portfolio has been updated successfully.',
      updatedFields: updateFields
    });

  } catch (error: any) {
    console.error('[DashboardAPI] Error patching profile metrics:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}