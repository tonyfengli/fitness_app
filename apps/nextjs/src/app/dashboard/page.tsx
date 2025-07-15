"use client";

import React, { useState } from "react";
import { 
  ResponsiveView, 
  useResponsive,
  Button,
  mockClients,
  mockExercises,
  FeedbackSection
} from "@acme/ui-shared";
import { 
  SidebarLayout, 
  ClientSidebar, 
  WorkoutProgramCard
} from "@acme/ui-desktop";

export default function Dashboard() {
  const { isDesktopView, isMobileView } = useResponsive();
  const [selectedClientId, setSelectedClientId] = useState<string>("1");
  const [isFeedbackExpanded, setIsFeedbackExpanded] = useState(true);
  const selectedClient = mockClients.find(c => c.id === selectedClientId);

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

            {/* Desktop Content */}
            <div className="space-y-12">
              <section>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900">Active Programs</h2>
                  <button className="text-indigo-600 hover:text-indigo-800 font-medium">
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
                    <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 shadow-sm">
                      <FeedbackSection
                        isExpanded={isFeedbackExpanded}
                        onToggle={() => setIsFeedbackExpanded(!isFeedbackExpanded)}
                        onAddNote={() => console.log("Add note")}
                      />
                    </div>
                  </div>
                  
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
      }
      mobile={
        <div className="bg-white min-h-screen">
          {/* Mobile Header */}
          <header className="bg-white px-4 py-3 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-800">My Workouts</h1>
          </header>

          <div className="px-4 py-3">
            {/* Mobile Client Profile */}
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <div className="flex items-center">
                <img 
                  alt={`Profile picture of ${selectedClient?.name}`}
                  className="w-12 h-12 rounded-full mr-4" 
                  src={selectedClient?.avatar}
                />
                <div>
                  <h2 className="font-semibold text-lg text-gray-900">{selectedClient?.name}</h2>
                  <p className="text-gray-600 text-sm">{selectedClient?.program}</p>
                </div>
              </div>
            </div>

            {/* Mobile Workout */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800">Workout Program - 2024-07-20</h3>
                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
                  <span className="material-icons text-base mr-1">edit</span>
                  Edit
                </button>
              </div>
              
              <div className="space-y-3">
                {mockExercises.map((exercise) => (
                  <div key={exercise.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="p-2 bg-gray-200 rounded-full mr-3">
                        <span className="material-icons text-gray-600">fitness_center</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{exercise.name}</p>
                        <p className="text-sm text-gray-500">{exercise.sets} sets</p>
                      </div>
                    </div>
                    <button className="text-gray-500 hover:text-gray-700">
                      <span className="material-icons">play_circle_outline</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Mobile Feedback Section */}
              <div className="pt-4 mt-6">
                <button 
                  onClick={() => setIsFeedbackExpanded(!isFeedbackExpanded)}
                  className="w-full flex justify-between items-center text-left"
                >
                  <span className="font-medium text-gray-700">View Client Feedback</span>
                  <span className="material-icons text-gray-500">
                    {isFeedbackExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {isFeedbackExpanded && (
                  <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                    Client feedback will be displayed here.
                  </div>
                )}
              </div>

              <button className="w-full mt-4 flex items-center justify-center py-2 px-4 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800">
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