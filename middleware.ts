import { clerkMiddleware } from '@clerk/nextjs/server';

// Makes the signed-in user available to pages and API routes.
// Each API route checks for a user itself (see lib/auth.ts).
// CLERK_JWT_KEY (optional) lets Clerk verify sessions without a network request.
export default clerkMiddleware({ jwtKey: process.env.CLERK_JWT_KEY });

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // Always run for Clerk-specific frontend API routes
    '/__clerk/(.*)',
  ],
};
