"use client";

import { Suspense } from "react";
import ExerciseList from "./exercise-list";
import ClientDropdown from "./client-dropdown";

export default function TrainerDashboardContent() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Trainer Dashboard</h1>
      
      {/* Client Selection Example */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <p className="text-sm text-gray-600 mb-2">
          💡 <strong>New Feature:</strong> You can now select a client to view their workout history, 
          schedule sessions, and create personalized workout plans.
        </p>
        <div className="mt-4">
          <ClientDropdown 
            onClientSelect={(client) => {
              if (client) {
                console.log("Selected client:", client);
                // This is where you can navigate to a client-specific view
                // or filter the content below based on the selected client
              }
            }}
            className="max-w-md"
          />
        </div>
      </div>

      {/* Exercise Library Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Exercise Library</h2>
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-12 bg-gray-200 rounded animate-pulse"></div>
            </div>
          }
        >
          <ExerciseList />
        </Suspense>
      </div>
    </div>
  );
}