"use client";

import React, { useState } from "react";

import {
  ClientSidebar,
  SidebarLayout,
  WorkoutProgramCard,
} from "@acme/ui-desktop";
import {
  Button,
  FeedbackSection,
  mockClients,
  mockExercises,
  ResponsiveView,
  useResponsive,
} from "@acme/ui-shared";

export default function Dashboard() {
  const { isDesktopView, isMobileView } = useResponsive();
  const [selectedClientId, setSelectedClientId] = useState<string>("1");
  const [isFeedbackExpanded, setIsFeedbackExpanded] = useState(true);
  const selectedClient = mockClients.find((c) => c.id === selectedClientId);

  return (
    <ResponsiveView
      desktop={
        <SidebarLayout
          sidebar={
            <ClientSidebar
              clients={mockClients}
              selectedClientId={selectedClientId}
              onClientSelect={(client) => setSelectedClientId(client.id)}
              onAddNewClient={() => console.log("Add new client")}
            />
          }
        >
          <div className="p-8">
            {/* Desktop Header */}
            <header className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-gray-900">
                  {selectedClient?.name}
                </h1>
                <p className="mt-1 text-gray-500">{selectedClient?.program}</p>
              </div>
              <div className="flex items-center space-x-4">
                <button className="relative rounded-full p-2 hover:bg-gray-200">
                  <span className="material-icons text-gray-600">
                    notifications
                  </span>
                  <span className="absolute right-1 top-1 block h-2 w-2 rounded-full bg-red-500"></span>
                </button>
              </div>
            </header>

            {/* Desktop Content */}
            <div className="space-y-12">
              <section>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-gray-900">
                    Active Programs
                  </h2>
                  <button className="font-medium text-indigo-600 hover:text-indigo-800">
                    View All
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <WorkoutProgramCard
                      title="Upper Body A"
                      week="Week 1 of 4"
                      exercises={mockExercises}
                      onAddExercise={() => console.log("Add exercise")}
                      onEditExercise={(id) => console.log("Edit exercise", id)}
                      className="rounded-b-none"
                      showEditButton={true}
                    />
                    <div className="rounded-b-lg border border-t-0 border-gray-200 bg-white shadow-sm">
                      <FeedbackSection
                        isExpanded={isFeedbackExpanded}
                        onToggle={() =>
                          setIsFeedbackExpanded(!isFeedbackExpanded)
                        }
                        onAddNote={() => console.log("Add note")}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={() => console.log("Add exercise")}
                      variant="primary"
                      size="sm"
                      className="flex items-center bg-gray-800 hover:bg-gray-700"
                    >
                      <span className="material-icons mr-2 text-[16px]">
                        add
                      </span>
                      <span>Add Exercise</span>
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </SidebarLayout>
      }
      mobile={
        <div className="min-h-screen bg-white">
          {/* Mobile Header */}
          <header className="border-b border-gray-200 bg-white px-4 py-3">
            <h1 className="text-xl font-bold text-gray-800">My Workouts</h1>
          </header>

          <div className="px-4 py-3">
            {/* Mobile Client Profile */}
            <div className="mb-6 rounded-lg bg-blue-50 p-4">
              <div className="flex items-center">
                <img
                  alt={`Profile picture of ${selectedClient?.name}`}
                  className="mr-4 h-12 w-12 rounded-full"
                  src={selectedClient?.avatar}
                />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedClient?.name}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {selectedClient?.program}
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile Workout */}
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">
                  Workout Program - 2024-07-20
                </h3>
                <button className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800">
                  <span className="material-icons mr-1 text-base">edit</span>
                  Edit
                </button>
              </div>

              <div className="space-y-3">
                {mockExercises.map((exercise) => (
                  <div
                    key={exercise.id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                  >
                    <div className="flex items-center">
                      <div className="mr-3 rounded-full bg-gray-200 p-2">
                        <span className="material-icons text-gray-600">
                          fitness_center
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {exercise.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {exercise.sets} sets
                        </p>
                      </div>
                    </div>
                    <button className="text-gray-500 hover:text-gray-700">
                      <span className="material-icons">
                        play_circle_outline
                      </span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Mobile Feedback Section */}
              <div className="mt-6 pt-4">
                <button
                  onClick={() => setIsFeedbackExpanded(!isFeedbackExpanded)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="font-medium text-gray-700">
                    View Client Feedback
                  </span>
                  <span className="material-icons text-gray-500">
                    {isFeedbackExpanded ? "expand_less" : "expand_more"}
                  </span>
                </button>
                {isFeedbackExpanded && (
                  <div className="mt-2 rounded-md bg-gray-50 p-3 text-sm text-gray-500">
                    Client feedback will be displayed here.
                  </div>
                )}
              </div>

              <button className="mt-4 flex w-full items-center justify-center rounded-lg bg-gray-700 px-4 py-2 font-medium text-white hover:bg-gray-800">
                <span className="material-icons mr-2">add</span>
                Add Exercise
              </button>
            </div>
          </div>
        </div>
      }
    />
  );
}
