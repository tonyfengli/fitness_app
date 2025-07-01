import { Suspense } from "react";
import DatabaseTestContent from "./test-content";

export default function DatabaseTestPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Database Connectivity Test</h1>
      
      <Suspense
        fallback={
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
            <h2 className="font-bold text-lg">🔄 Testing Database Connection...</h2>
          </div>
        }
      >
        <DatabaseTestContent />
      </Suspense>
    </div>
  );
}