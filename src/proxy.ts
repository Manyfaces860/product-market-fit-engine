import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Protect the API routes that perform heavy LLM calculations
const isProtectedRoute = createRouteMatcher([
  '/api/problems(.*)',
  '/api/search(.*)', // 🚀 Protect semantic search endpoint too!
]);

export default clerkMiddleware(async (auth, req) => {
  // If we are in E2E testing mode, bypass Clerk's middleware completely if the bypass cookie or header is present
  if (process.env.NEXT_PUBLIC_E2E_TESTING === 'true') {
    const e2eUserId = req.headers.get('x-e2e-user-id') || req.cookies.get('e2e_user_id')?.value;
    if (e2eUserId) {
      return NextResponse.next();
    }
  }

  if (isProtectedRoute(req)) {
    const {userId} = await auth();
    if (!userId) {
      if (req.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json(
          {error : "Unauthorized", message: "you must be signed in to perform searches"},
          {status: 401}
        )
      }
    }
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.[\\w]+$|_next/image|favicon.ico).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
