"use client";

import { Suspense, useState } from "react";

import ClientDropdown from "./client-dropdown";
import ExerciseList from "./exercise-list";

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
    <div className="container mx-auto h-screen overflow-y-auto py-8">
      <h1 className="mb-6 text-3xl font-bold">Trainer Dashboard</h1>

      {/* Client Selection Example */}
      <div className="mb-6 rounded-lg bg-gray-50 p-4">
        <p className="mb-2 text-sm text-gray-600">
          💡 <strong>New Feature:</strong> You can now select a client to view
          their workout history, schedule sessions, and create personalized
          workout plans.
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
              <div className="rounded-md bg-blue-50 p-3">
                <p className="text-sm font-medium text-blue-900">
                  {selectedClient.name || selectedClient.email} -
                  <span className="ml-2">
                    Strength: {selectedClient.profile.strengthLevel}
                  </span>
                  <span className="ml-2">
                    Skill: {selectedClient.profile.skillLevel}
                  </span>
                </p>
              </div>
            ) : (
              <div className="rounded-md bg-yellow-50 p-3">
                <p className="text-sm font-medium text-yellow-800">
                  ⚠️ {selectedClient.name || selectedClient.email} has no
                  fitness profile set up. Default values (moderate/moderate)
                  will be used.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Exercise Library Section */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">Exercise Library</h2>
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-12 animate-pulse rounded bg-gray-200"></div>
              <div className="h-12 animate-pulse rounded bg-gray-200"></div>
              <div className="h-12 animate-pulse rounded bg-gray-200"></div>
            </div>
          }
        >
          <ExerciseList selectedClient={selectedClient} />
        </Suspense>
      </div>
    </div>
  );
}
