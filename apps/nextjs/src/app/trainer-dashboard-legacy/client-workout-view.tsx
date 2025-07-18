"use client";

import { useState } from "react";
import ClientDropdown from "./client-dropdown";
import { useTRPC } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";

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
      clientId: selectedClient?.id ?? "" 
    }),
    enabled: !!selectedClient
  });

  return (
    <div className="space-y-6">
      {/* Client Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Select Client</h2>
        <ClientDropdown 
          onClientSelect={setSelectedClient}
          className="max-w-md"
        />
      </div>

      {/* Selected Client Info */}
      {selectedClient && (
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Selected Client</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Name:</span>{" "}
              {selectedClient.name}
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
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Workout History</h3>
          {isLoading ? (
            <div className="text-gray-500">Loading workouts...</div>
          ) : workouts && workouts.length > 0 ? (
            <div className="space-y-3">
              {workouts.map((workoutData) => (
                <div
                  key={workoutData.workout.id}
                  className="border rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        {new Date(workoutData.workout.completedAt).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        {workoutData.exerciseCount} exercises completed
                      </p>
                      {workoutData.workout.notes && (
                        <p className="text-sm text-gray-500 mt-1">{workoutData.workout.notes}</p>
                      )}
                    </div>
                    <button className="text-blue-600 hover:text-blue-800 text-sm">
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
        <div className="bg-green-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Quick Actions</h3>
          <div className="flex gap-4">
            <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              Log New Workout
            </button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Schedule Training Session
            </button>
            <button className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
              Generate Workout Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}