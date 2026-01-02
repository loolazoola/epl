"use client";

import { useSession } from "next-auth/react";
import { useRequireAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingSpinner from "@/components/LoadingSpinner";
import Navigation from "@/components/Navigation";

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
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="pl-gradient shadow-lg border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pl-secondary rounded-lg flex items-center justify-center">
                  <span className="text-pl-primary font-bold text-xl">⚽</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-pl-white">
                  Premier League Predictions
                </h1>
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
                  {session.user.image && (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="w-8 h-8 rounded-full border-2 border-pl-secondary"
                    />
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <span className="text-sm font-medium text-pl-white">
                      {session.user.name}
                    </span>
                    <span className="text-sm text-pl-secondary font-bold bg-pl-white/20 px-2 py-1 rounded">
                      {session.user.totalPoints} points
                    </span>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="text-sm text-pl-white/80 hover:text-pl-white transition-colors px-3 py-2 rounded-lg hover:bg-white/10"
                >
                  Sign out
                </button>
              </div>
            </div>
            
            {/* Navigation */}
            <div className="pb-4">
              <Navigation />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Welcome Section */}
          <div className="pl-card pl-card-hover p-6 sm:p-8 mb-8">
            <div className="text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-card-foreground mb-4">
                Welcome to Premier League Predictions!
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Predict match scores and compete with other fans on the leaderboard.
              </p>
              
              <div className="bg-pl-secondary/10 border border-pl-secondary/20 p-4 sm:p-6 rounded-lg mb-8">
                <h3 className="text-lg sm:text-xl font-semibold text-pl-primary mb-2">
                  🎉 Authentication Successful!
                </h3>
                <p className="text-pl-primary/80">
                  Welcome back, {session.user.name}! You're successfully logged in.
                </p>
              </div>
            </div>
          </div>
              
          {/* Quick Navigation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
            <a 
              href="/matches" 
              className="pl-card pl-card-hover group p-6 text-center transition-all duration-200 hover:border-pl-primary/30"
            >
              <div className="text-3xl sm:text-4xl mb-3 group-hover:scale-110 transition-transform">📅</div>
              <div className="font-semibold text-card-foreground mb-1">Fixtures</div>
              <div className="text-sm text-muted-foreground">Upcoming matches</div>
            </a>
            
            <a 
              href="/results" 
              className="pl-card pl-card-hover group p-6 text-center transition-all duration-200 hover:border-pl-secondary/30"
            >
              <div className="text-3xl sm:text-4xl mb-3 group-hover:scale-110 transition-transform">⚽</div>
              <div className="font-semibold text-card-foreground mb-1">Results</div>
              <div className="text-sm text-muted-foreground">Recent scores</div>
            </a>
            
            <a 
              href="/leaderboard" 
              className="pl-card pl-card-hover group p-6 text-center transition-all duration-200 hover:border-pl-accent/30"
            >
              <div className="text-3xl sm:text-4xl mb-3 group-hover:scale-110 transition-transform">🏆</div>
              <div className="font-semibold text-card-foreground mb-1">Leaderboard</div>
              <div className="text-sm text-muted-foreground">Player rankings</div>
            </a>
            
            <a 
              href="/table" 
              className="pl-card pl-card-hover group p-6 text-center transition-all duration-200 hover:border-muted-foreground/30"
            >
              <div className="text-3xl sm:text-4xl mb-3 group-hover:scale-110 transition-transform">📊</div>
              <div className="font-semibold text-card-foreground mb-1">Table</div>
              <div className="text-sm text-muted-foreground">League standings</div>
            </a>
            
            <a 
              href="/api-test" 
              className="pl-card pl-card-hover group p-6 text-center transition-all duration-200 hover:border-muted-foreground/30"
            >
              <div className="text-3xl sm:text-4xl mb-3 group-hover:scale-110 transition-transform">🔧</div>
              <div className="font-semibold text-card-foreground mb-1">API Test</div>
              <div className="text-sm text-muted-foreground">Test connection</div>
            </a>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="pl-card p-6 border-l-4 border-l-pl-primary">
              <h3 className="text-xl font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                Make Predictions
              </h3>
              <p className="text-muted-foreground">
                Predict scores for upcoming Premier League matches before they start.
              </p>
            </div>
            
            <div className="pl-card p-6 border-l-4 border-l-pl-secondary">
              <h3 className="text-xl font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <span className="text-2xl">⭐</span>
                Earn Points
              </h3>
              <p className="text-muted-foreground">
                Get 5 points for exact scores, 2 points for correct outcomes.
              </p>
            </div>
            
            <div className="pl-card p-6 border-l-4 border-l-pl-accent">
              <h3 className="text-xl font-semibold text-card-foreground mb-3 flex items-center gap-2">
                <span className="text-2xl">🏅</span>
                Compete
              </h3>
              <p className="text-muted-foreground">
                Climb the leaderboard and see how you rank against other fans.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // If not authenticated, show loading or redirect
  return <LoadingSpinner message="Checking authentication..." />;
}
