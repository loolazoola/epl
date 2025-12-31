"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useAuth(requireAuth: boolean = true) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Handle session persistence across browser refreshes (Requirement 1.5)
    if (requireAuth && status === "unauthenticated") {
      // Redirect to sign-in page if authentication is required
      router.push("/auth/signin");
    }
  }, [status, requireAuth, router]);

  const login = async () => {
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut({ callbackUrl: "/auth/signin" });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return {
    user: session?.user,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    login,
    logout,
  };
}

export function useRequireAuth() {
  return useAuth(true);
}

export function useOptionalAuth() {
  return useAuth(false);
}