"use client";

import React, { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
// Icon components as inline SVGs
const Check = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const X = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const Plus = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

// Dummy data matching the screenshot
const DUMMY_CLIENTS = [
  {
    id: "client1",
    name: "Hilary Chan",
    avatar: "hilary123",
    exerciseCount: 5,
    confirmedExercises: [
      { name: "Kettlebell Deadlift", confirmed: true },
      { name: "Dumbbell Bench Row", confirmed: true }
    ],
    muscleFocus: [],
    avoidance: []
  },
  {
    id: "client2",
    name: "Curtis Yu",
    avatar: "curtis456",
    exerciseCount: 5,
    confirmedExercises: [
      { name: "Dumbbell Thruster", confirmed: true },
      { name: "Band Pull-Apart", confirmed: true }
    ],
    muscleFocus: ["Shoulders"],
    avoidance: []
  },
  {
    id: "client3",
    name: "Tony Lee",
    avatar: "tony789",
    exerciseCount: 6,
    confirmedExercises: [
      { name: "Curtsy Lunge", confirmed: true },
      { name: "Landmine T Bar Row", confirmed: true }
    ],
    muscleFocus: [],
    avoidance: ["Left Knee"]
  }
];

export default function PreferencesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "dummy-session";

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Workout Preferences</h1>
        </div>

        {/* Client Cards Grid */}
        <div className="grid grid-cols-3 gap-6">
          {DUMMY_CLIENTS.map((client) => (
            <div key={client.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* Client Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.avatar}`}
                    alt={client.name}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900">{client.name}</h3>
                    <p className="text-sm text-gray-500">{client.exerciseCount} exercises</p>
                  </div>
                </div>
              </div>

              {/* Section 1: Confirm Exercises */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <h4 className="font-medium text-gray-900">Confirm Exercises</h4>
                </div>
                <div className="space-y-3">
                  {client.confirmedExercises.map((exercise, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-700">{exercise.name}</span>
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white">
                        <Check />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Muscle Focus & Avoidance */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <h4 className="font-medium text-gray-900">Muscle Focus & Avoidance</h4>
                </div>
                <div className="space-y-3">
                  {/* Muscle Focus Items */}
                  {client.muscleFocus.map((muscle, idx) => (
                    <div key={`focus-${idx}`} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-blue-700 font-medium">Focus: {muscle}</span>
                      <button className="text-gray-400 hover:text-gray-600">
                        <X />
                      </button>
                    </div>
                  ))}
                  
                  {/* Avoidance Items */}
                  {client.avoidance.map((item, idx) => (
                    <div key={`avoid-${idx}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <span className="text-red-700 font-medium">Avoid: {item}</span>
                      <button className="text-gray-400 hover:text-gray-600">
                        <X />
                      </button>
                    </div>
                  ))}
                  
                  {/* Add button if no items or has items */}
                  {(client.muscleFocus.length === 0 && client.avoidance.length === 0) ? (
                    <button className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center gap-2">
                      <Plus />
                      Add Focus or Avoidance
                    </button>
                  ) : (
                    <button className="w-full p-3 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 flex items-center justify-center gap-2">
                      <Plus />
                      Add More
                    </button>
                  )}
                </div>
              </div>

              {/* Section 3: Other Notes */}
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <h4 className="font-medium text-gray-900">Other Notes</h4>
                </div>
                <div className="space-y-3">
                  <button className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center gap-2">
                    <Plus />
                    Add Note
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={() => router.back()}
            className="px-6 py-2 text-gray-600 hover:text-gray-900"
          >
            Back
          </button>
          <button
            onClick={() => router.push(`/session-lobby/group-visualization?sessionId=${sessionId}`)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Continue to Workout
          </button>
        </div>
      </div>
    </div>
  );
}