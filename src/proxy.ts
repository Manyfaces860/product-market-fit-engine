import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Protect the API routes that perform heavy LLM calculations
const isProtectedRoute = createRouteMatcher([
  '/api/problems(.*)',
  '/api/search(.*)', // 🚀 Protect semantic search endpoint too!
]);

export default clerkMiddleware(async (auth, req) => {
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
