import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Additional middleware logic can be added here
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Check if user has a valid token
        if (!token) {
          return false;
        }

        // Allow access to authenticated users
        return true;
      },
    },
  }
);

// Configure which routes should be protected
export const config = {
  matcher: [
    // Protect all routes except auth pages, API auth routes, football API routes, and static files
    "/((?!api/auth|api/football|auth|_next/static|_next/image|favicon.ico|public|api-test).*)",
  ],
};