"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import SignInButton from "./SignInButton";

export default function SignInPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Redirect if already signed in
    if (session) {
      router.push("/");
    }
  }, [session, router]);

  // Don't render if already authenticated
  if (status === "authenticated") {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-purple-700">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-xl">
        <div className="text-center">
          <div className="mb-4">
            <div className="text-6xl mb-2">⚽</div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Premier League Predictions
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to start making predictions and compete on the leaderboard
          </p>
        </div>
        
        <div className="mt-8">
          <SignInButton />
        </div>
        
        <div className="mt-6 text-center">
          <div className="text-xs text-gray-500">
            By signing in, you agree to participate in friendly competition
          </div>
        </div>
      </div>
    </div>
  );
}