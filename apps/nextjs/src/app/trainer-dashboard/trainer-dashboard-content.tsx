"use client";

import { Suspense, useState } from "react";
import ExerciseList from "./exercise-list";
import ClientDropdown from "./client-dropdown";

interface Client {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  profile?: {
    strengthLevel: string;
    skillLevel: string;
    notes: string | null;
  } | null;
}

export default function TrainerDashboardContent() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

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
              setSelectedClient(client);
              if (client) {
                console.log("Selected client:", client);
              }
            }}
            className="max-w-md"
          />
        </div>
        
        {/* Display selected client's levels */}
        {selectedClient && (
          <div className="mt-4">
            {selectedClient.profile ? (
              <div className="p-3 bg-blue-50 rounded-md">
                <p className="text-sm font-medium text-blue-900">
                  {selectedClient.name || selectedClient.email} - 
                  <span className="ml-2">Strength: {selectedClient.profile.strengthLevel}</span>
                  <span className="ml-2">Skill: {selectedClient.profile.skillLevel}</span>
                </p>
              </div>
            ) : (
              <div className="p-3 bg-yellow-50 rounded-md">
                <p className="text-sm font-medium text-yellow-800">
                  ⚠️ {selectedClient.name || selectedClient.email} has no fitness profile set up. 
                  Default values (moderate/moderate) will be used.
                </p>
              </div>
            )}
          </div>
        )}
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
          <ExerciseList selectedClient={selectedClient} />
        </Suspense>
      </div>
    </div>
  );
}