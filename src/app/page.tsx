"use client";

import { useSession } from "next-auth/react";
import { useRequireAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function Home() {
  const { data: session, status } = useSession();
  const { user, isLoading, logout } = useRequireAuth();

  // Debug information
  console.log("Home page debug:", {
    sessionStatus: status,
    sessionUser: session?.user?.email,
    hookUser: user?.email,
    hookIsLoading: isLoading,
  });

  if (isLoading) {
    return <LoadingSpinner message="Loading your profile..." />;
  }

  // If we have a session, show the authenticated content directly
  if (status === "authenticated" && session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-purple-700">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <h1 className="text-2xl font-bold text-purple-900">
                Premier League Predictions
              </h1>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {session.user.image && (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    {session.user.name}
                  </span>
                  <span className="text-sm text-purple-600 font-semibold">
                    {session.user.totalPoints} points
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Welcome to Premier League Predictions!
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Predict match scores and compete with other fans on the leaderboard.
              </p>
              
              <div className="bg-green-100 p-4 rounded-lg mb-8">
                <h3 className="text-lg font-semibold text-green-800 mb-2">
                  🎉 Authentication Successful!
                </h3>
                <p className="text-green-700">
                  Welcome back, {session.user.name}! You're successfully logged in.
                </p>
              </div>
              
              {/* Quick Navigation */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <a 
                  href="/matches" 
                  className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg text-center transition-colors"
                >
                  <div className="text-2xl mb-2">📅</div>
                  <div className="font-semibold">Fixtures</div>
                  <div className="text-sm opacity-90">Upcoming matches</div>
                </a>
                
                <a 
                  href="/results" 
                  className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg text-center transition-colors"
                >
                  <div className="text-2xl mb-2">⚽</div>
                  <div className="font-semibold">Results</div>
                  <div className="text-sm opacity-90">Recent scores</div>
                </a>
                
                <a 
                  href="/table" 
                  className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg text-center transition-colors"
                >
                  <div className="text-2xl mb-2">🏆</div>
                  <div className="font-semibold">Table</div>
                  <div className="text-sm opacity-90">League standings</div>
                </a>
                
                <a 
                  href="/api-test" 
                  className="bg-gray-600 hover:bg-gray-700 text-white p-4 rounded-lg text-center transition-colors"
                >
                  <div className="text-2xl mb-2">🔧</div>
                  <div className="font-semibold">API Test</div>
                  <div className="text-sm opacity-90">Test connection</div>
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="bg-purple-50 p-6 rounded-lg">
                  <h3 className="text-xl font-semibold text-purple-900 mb-2">
                    Make Predictions
                  </h3>
                  <p className="text-purple-700">
                    Predict scores for upcoming Premier League matches before they start.
                  </p>
                </div>
                
                <div className="bg-purple-50 p-6 rounded-lg">
                  <h3 className="text-xl font-semibold text-purple-900 mb-2">
                    Earn Points
                  </h3>
                  <p className="text-purple-700">
                    Get 5 points for exact scores, 2 points for correct outcomes.
                  </p>
                </div>
                
                <div className="bg-purple-50 p-6 rounded-lg">
                  <h3 className="text-xl font-semibold text-purple-900 mb-2">
                    Compete
                  </h3>
                  <p className="text-purple-700">
                    Climb the leaderboard and see how you rank against other fans.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // If not authenticated, show loading or redirect
  return <LoadingSpinner message="Checking authentication..." />;
}
