"use client";

import { useState } from "react";
import Navigation from "@/components/Navigation";

export default function ApiTestPage() {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState<string | null>(null);

  const runTest = async (testName: string, url: string) => {
    setLoading(testName);
    try {
      const response = await fetch(url);
      const result = await response.json();
      setResults((prev: any) => ({
        ...prev,
        [testName]: result,
      }));
    } catch (error) {
      setResults((prev: any) => ({
        ...prev,
        [testName]: { 
          data: null,
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 0
        },
      }));
    } finally {
      setLoading(null);
    }
  };

  const testConnection = () => runTest('connection', '/api/football/test-connection');
  
  const testMatches = () => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return runTest('matches', `/api/football/matches?dateFrom=${today}&dateTo=${nextWeek}`);
  };
  
  const testStandings = () => runTest('standings', '/api/football/standings');

  const renderResult = (testName: string, result: any) => {
    if (!result) return null;

    return (
      <div className="bg-gray-100 p-4 rounded mb-4">
        <h3 className="font-semibold mb-2 capitalize">{testName} Test Result:</h3>
        
        {result.error ? (
          <div className="text-red-600">
            <p><strong>❌ Error:</strong> {result.error}</p>
            <p><strong>Status:</strong> {result.status}</p>
          </div>
        ) : (
          <div className="text-green-600">
            <p><strong>✅ Success!</strong> Status: {result.status}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-blue-600">View Response Data</summary>
              <pre className="text-xs bg-white p-2 rounded mt-2 overflow-auto max-h-64">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Football-Data.org API Test</h1>
        <Navigation className="mb-4" />
      </div>
      
      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          Test your connection to the Football-Data.org API. Make sure you have set your API key in the environment variables.
        </p>
        
        <div className="bg-blue-100 p-4 rounded mb-4">
          <h3 className="font-semibold text-blue-800">🔑 API Key Status:</h3>
          <p className="text-blue-700 mt-2">
            API Key: <code>cd450cd3ac60458aaff51e8a5c9622f2</code> ✅
          </p>
          <p className="text-blue-700">
            The API key is configured. Click the test buttons below to verify the connection.
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <button
          onClick={testConnection}
          disabled={loading === 'connection'}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 mr-4"
        >
          {loading === 'connection' ? 'Testing...' : 'Test API Connection'}
        </button>

        <button
          onClick={testMatches}
          disabled={loading === 'matches'}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 mr-4"
        >
          {loading === 'matches' ? 'Testing...' : 'Test Get Matches'}
        </button>

        <button
          onClick={testStandings}
          disabled={loading === 'standings'}
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
        >
          {loading === 'standings' ? 'Testing...' : 'Test Get Standings'}
        </button>
      </div>

      <div className="space-y-4">
        {renderResult('connection', results.connection)}
        {renderResult('matches', results.matches)}
        {renderResult('standings', results.standings)}
      </div>

      <div className="mt-8 bg-blue-50 p-4 rounded">
        <h3 className="font-semibold text-blue-800 mb-2">🔍 What each test does:</h3>
        <ul className="text-blue-700 space-y-1">
          <li><strong>API Connection:</strong> Tests basic connectivity and fetches Premier League competition info</li>
          <li><strong>Get Matches:</strong> Fetches upcoming Premier League matches for the next 7 days</li>
          <li><strong>Get Standings:</strong> Fetches current Premier League table/standings</li>
        </ul>
      </div>
    </div>
  );
}