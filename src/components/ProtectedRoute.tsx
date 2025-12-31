"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export default function ProtectedRoute({ 
  children, 
  fallback = <div>Loading...</div> 
}: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Handle session validation and route protection (Requirement 1.5)
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // Show loading state while checking authentication
  if (status === "loading") {
    return <>{fallback}</>;
  }

  // Show loading state while redirecting unauthenticated users
  if (status === "unauthenticated") {
    return <>{fallback}</>;
  }

  // Render children for authenticated users
  if (status === "authenticated" && session) {
    return <>{children}</>;
  }

  // Fallback for any other state
  return <>{fallback}</>;
}