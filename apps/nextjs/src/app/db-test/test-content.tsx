"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import Link from "next/link";

export default function DatabaseTestContent() {
  const trpc = useTRPC();
  
  const { data: serverTime } = useSuspenseQuery(trpc.auth.getServerTime.queryOptions());
  const { data: dbInfo } = useSuspenseQuery(trpc.auth.getDatabaseInfo.queryOptions());

  const isConnected = serverTime.tableAccessible && dbInfo.connected;

  return (
    <div className="space-y-6">
      {isConnected ? (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <h2 className="font-bold text-lg">✅ Database Connection Successful!</h2>
        </div>
      ) : (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <h2 className="font-bold text-lg">❌ Database Connection Failed!</h2>
        </div>
      )}

      <div className="bg-white border rounded-lg p-6 shadow">
        <h3 className="text-xl font-semibold mb-4">Connection Test Results</h3>
        <p><strong>Message:</strong> {serverTime.message}</p>
        <p><strong>Table Accessible:</strong> {serverTime.tableAccessible ? "✅ Yes" : "❌ No"}</p>
        <p><strong>Test Time:</strong> {new Date(serverTime.serverTime).toLocaleString()}</p>
        {serverTime.postCount !== undefined && (
          <p><strong>Posts Found:</strong> {serverTime.postCount}</p>
        )}
        {serverTime.error && (
          <p className="text-red-600"><strong>Error:</strong> {serverTime.error}</p>
        )}
      </div>

      <div className="bg-white border rounded-lg p-6 shadow">
        <h3 className="text-xl font-semibold mb-4">Database Information</h3>
        <p><strong>Status:</strong> {dbInfo.connected ? "✅ Connected" : "❌ Disconnected"}</p>
        <p><strong>Message:</strong> {dbInfo.message}</p>
        <p><strong>Test Time:</strong> {new Date(dbInfo.testTimestamp).toLocaleString()}</p>
        
        {dbInfo.connected && (
          <>
            <p><strong>Post Table Rows:</strong> {dbInfo.postTableRows}</p>
            {dbInfo.samplePosts && dbInfo.samplePosts.length > 0 && (
              <div className="mt-4">
                <p><strong>Sample Posts:</strong></p>
                <ul className="list-disc list-inside ml-4">
                  {dbInfo.samplePosts.map((post: any, index: number) => (
                    <li key={index}>ID: {post.id} - Title: {post.title}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        
        {dbInfo.error && (
          <p className="text-red-600"><strong>Error:</strong> {dbInfo.error}</p>
        )}
      </div>

      {isConnected ? (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
          <h3 className="font-bold">Connection Details:</h3>
          <p>✅ Using Vercel Postgres with Drizzle ORM</p>
          <p>✅ Connection pooler working correctly</p>
          <p>✅ tRPC procedures executing successfully</p>
          <p>✅ Post table accessible and queryable</p>
        </div>
      ) : (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <h3 className="font-bold">Troubleshooting Steps:</h3>
          <ul className="mt-2 list-disc list-inside">
            <li>Check your .env file has the correct POSTGRES_URL</li>
            <li>Verify Supabase connection string uses the pooler (port 6543)</li>
            <li>Ensure your Supabase project is running</li>
            <li>Run `pnpm db:push` to ensure the Post table exists</li>
            <li>Check network connectivity</li>
          </ul>
        </div>
      )}

      <div className="mt-8">
        <Link 
          href="/" 
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}