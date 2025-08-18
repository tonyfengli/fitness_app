"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";
import ClientDropdown from "./client-dropdown";

interface Client {
  id: string;
  email: string;
  phone: string | null;
  name: string;
}

export default function ClientWorkoutView() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const trpc = useTRPC();

  // Example: Fetch workouts for selected client
  const { data: workouts, isLoading } = useQuery({
    ...trpc.workout.clientWorkouts.queryOptions({
      clientId: selectedClient?.id ?? "",
    }),
    enabled: !!selectedClient,
  });

  return (
    <div className="space-y-6">
      {/* Client Selection */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">Select Client</h2>
        <ClientDropdown
          onClientSelect={setSelectedClient}
          className="max-w-md"
        />
      </div>

      {/* Selected Client Info */}
      {selectedClient && (
        <div className="rounded-lg bg-blue-50 p-6">
          <h3 className="mb-2 text-lg font-semibold">Selected Client</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Name:</span> {selectedClient.name}
            </div>
            <div>
              <span className="font-medium">Email:</span> {selectedClient.email}
            </div>
            <div>
              <span className="font-medium">Phone:</span>{" "}
              {selectedClient.phone || "N/A"}
            </div>
            <div>
              <span className="font-medium">ID:</span> {selectedClient.id}
            </div>
          </div>
        </div>
      )}

      {/* Workout History */}
      {selectedClient && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-lg font-semibold">Workout History</h3>
          {isLoading ? (
            <div className="text-gray-500">Loading workouts...</div>
          ) : workouts && workouts.length > 0 ? (
            <div className="space-y-3">
              {workouts.map((workoutData) => (
                <div
                  key={workoutData.workout.id}
                  className="rounded-lg border p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">
                        {new Date(
                          workoutData.workout.completedAt,
                        ).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        {workoutData.exerciseCount} exercises completed
                      </p>
                      {workoutData.workout.notes && (
                        <p className="mt-1 text-sm text-gray-500">
                          {workoutData.workout.notes}
                        </p>
                      )}
                    </div>
                    <button className="text-sm text-blue-600 hover:text-blue-800">
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No workouts found for this client.</p>
          )}
        </div>
      )}

      {/* Call to Action */}
      {selectedClient && (
        <div className="rounded-lg bg-green-50 p-6">
          <h3 className="mb-2 text-lg font-semibold">Quick Actions</h3>
          <div className="flex gap-4">
            <button className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">
              Log New Workout
            </button>
            <button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Schedule Training Session
            </button>
            <button className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700">
              Generate Workout Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
