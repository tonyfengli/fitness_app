import { Suspense } from "react";

import DatabaseTestContent from "./test-content";

// Disable static generation for this page since it needs to make API calls
export const dynamic = "force-dynamic";

export default function DatabaseTestPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-6 text-3xl font-bold">Database Connectivity Test</h1>

      <Suspense
        fallback={
          <div className="rounded border border-blue-400 bg-blue-100 px-4 py-3 text-blue-700">
            <h2 className="text-lg font-bold">
              🔄 Testing Database Connection...
            </h2>
          </div>
        }
      >
        <DatabaseTestContent />
      </Suspense>
    </div>
  );
}
