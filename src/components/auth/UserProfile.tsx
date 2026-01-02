"use client";

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

interface UserProfileProps {
  className?: string;
  showPoints?: boolean;
  showSignOut?: boolean;
}

export default function UserProfile({ 
  className = "",
  showPoints = true,
  showSignOut = true
}: UserProfileProps) {
  const { data: session } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!session?.user) {
    return null;
  }

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut({ callbackUrl: "/auth/signin" });
    } catch (error) {
      console.error("Sign out error:", error);
      setIsSigningOut(false);
    }
  };

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      <div className="flex items-center space-x-2">
        {session.user.image && (
          <img
            src={session.user.image}
            alt={session.user.name || "User"}
            className="w-8 h-8 rounded-full border-2 border-purple-200"
          />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-700">
            {session.user.name}
          </span>
          {showPoints && (
            <span className="text-xs text-purple-600 font-semibold">
              {session.user.totalPoints || 0} points
            </span>
          )}
        </div>
      </div>
      
      {showSignOut && (
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
        >
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
      )}
    </div>
  );
}