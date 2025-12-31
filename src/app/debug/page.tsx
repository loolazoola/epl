"use client";

import { useSession } from "next-auth/react";

export default function DebugPage() {
  const { data: session, status } = useSession();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Session</h1>
      
      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-semibold">Session Status:</h2>
        <p>Status: {status}</p>
      </div>

      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-semibold">Session Data:</h2>
        <pre className="text-sm overflow-auto">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>

      <div className="bg-gray-100 p-4 rounded">
        <h2 className="font-semibold">Debug Info:</h2>
        <p>✅ Authentication is working!</p>
        <p>✅ User is logged in as: {session?.user?.name}</p>
        <p>✅ User has ID: {session?.user?.id}</p>
        <p>✅ Total Points: {session?.user?.totalPoints}</p>
      </div>
    </div>
  );
}