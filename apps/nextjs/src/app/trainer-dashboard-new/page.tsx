"use client";

import React, { useState } from "react";
import { 
  SidebarLayout, 
  ClientSidebar, 
  WorkoutProgramCard
} from "@acme/ui-desktop";
import { Button, mockClients, mockExercises, FeedbackSection } from "@acme/ui-shared";

export default function TrainerDashboardNew() {
  const [selectedClientId, setSelectedClientId] = useState<string>("1");
  const [isFeedbackExpanded, setIsFeedbackExpanded] = useState(true);

  const selectedClient = mockClients.find(c => c.id === selectedClientId);

  return (
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
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{selectedClient?.name}</h1>
            <p className="text-gray-500 mt-1">{selectedClient?.program}</p>
          </div>
          <div className="flex items-center space-x-4">
            <button className="relative p-2 rounded-full hover:bg-gray-200">
              <span className="material-icons text-gray-600">notifications</span>
              <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500"></span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="space-y-12">
          {/* Active Programs */}
          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">Active Programs</h2>
              <button className="text-indigo-600 hover:text-indigo-800 font-medium">
                View All
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Workout Card with attached Feedback */}
              <div>
                <WorkoutProgramCard
                  title="Upper Body A"
                  week="Week 1 of 4"
                  exercises={mockExercises}
                  onAddExercise={() => console.log("Add exercise")}
                  onEditExercise={(id) => console.log("Edit exercise", id)}
                  className="rounded-b-none"
                />
                <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 shadow-sm">
                  <FeedbackSection
                    isExpanded={isFeedbackExpanded}
                    onToggle={() => setIsFeedbackExpanded(!isFeedbackExpanded)}
                    onAddNote={() => console.log("Add note")}
                  />
                </div>
              </div>
              
              {/* Add Exercise Button */}
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={() => console.log("Add exercise")}
                  variant="primary"
                  size="sm"
                  className="bg-gray-800 hover:bg-gray-700 flex items-center"
                >
                  <span className="material-icons text-[16px] mr-2">add</span>
                  <span>Add Exercise</span>
                </Button>
              </div>
            </div>
          </section>

        </div>
      </div>
    </SidebarLayout>
  );
}