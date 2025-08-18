"use client";

import React, { useState } from "react";

export default function TrainerDashboardMobile() {
  const [feedback1Expanded, setFeedback1Expanded] = useState(true);
  const [feedback2Expanded, setFeedback2Expanded] = useState(false);

  const mockExercises = [
    { id: "1", name: "Squats", sets: 3 },
    { id: "2", name: "Bench Press", sets: 3 },
    { id: "3", name: "Deadlifts", sets: 3 },
  ];

  const mockExercises2 = [
    { id: "4", name: "Pull-ups", sets: 3 },
    { id: "5", name: "Overhead Press", sets: 3 },
    { id: "6", name: "Barbell Rows", sets: 3 },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-xl font-bold text-gray-800">My Workouts</h1>
      </header>

      <div className="px-4 py-3">
        {/* Client Profile Card */}
        <div className="mb-6 rounded-lg bg-blue-50 p-4">
          <div className="flex items-center">
            <img
              alt="Profile picture of Olivia Carter"
              className="mr-4 h-12 w-12 rounded-full"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDIeLmYWb8tK-gWfoQYAw7zpYbgwOaL-OGsdGtWkQBk4FVgbbUQex4_BQpvdxAFU5xokk29v881Ypk2wLBiLx-0QY09DZdSCvNqkW0CVGdw8sc9citoSEW2KJBpJEsgs0bG8IIDDcbn7dXk7DZZHAtq-NGvFSqscNAi3TtQUCXYhuuR3kRLD92fDCVwyxcXIxyoZPifxTGlZQFEGO92YZYWtxF_anZ0zF5OmpZjvC-rmW0mV7lVFsA7-O_J5PiK_UxqpvpJUaHuZvEt"
            />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Olivia Carter
              </h2>
              <p className="text-sm text-gray-600">Strength Training</p>
            </div>
          </div>
        </div>

        {/* Workout Program 1 */}
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
                    <p className="font-medium text-gray-800">{exercise.name}</p>
                    <p className="text-sm text-gray-500">
                      {exercise.sets} sets
                    </p>
                  </div>
                </div>
                <button className="text-gray-500 hover:text-gray-700">
                  <span className="material-icons">play_circle_outline</span>
                </button>
              </div>
            ))}
          </div>

          {/* Feedback Section */}
          <div className="mt-6 pt-4">
            <button
              onClick={() => setFeedback1Expanded(!feedback1Expanded)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="font-medium text-gray-700">
                View Client Feedback
              </span>
              <span className="material-icons text-gray-500">
                {feedback1Expanded ? "expand_less" : "expand_more"}
              </span>
            </button>
            {feedback1Expanded && (
              <div className="mt-2 rounded-md bg-gray-50 p-3 text-sm text-gray-500">
                Client feedback will be displayed here.
              </div>
            )}
          </div>
        </div>

        <div className="my-6 border-t border-gray-200"></div>

        {/* Workout Program 2 */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">
              Workout Program - 2024-07-22
            </h3>
            <button className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800">
              <span className="material-icons mr-1 text-base">edit</span>
              Edit
            </button>
          </div>

          <div className="space-y-3">
            {mockExercises2.map((exercise) => (
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
                    <p className="font-medium text-gray-800">{exercise.name}</p>
                    <p className="text-sm text-gray-500">
                      {exercise.sets} sets
                    </p>
                  </div>
                </div>
                <button className="text-gray-500 hover:text-gray-700">
                  <span className="material-icons">play_circle_outline</span>
                </button>
              </div>
            ))}
          </div>

          {/* Feedback Section */}
          <div className="mt-6 pt-4">
            <button
              onClick={() => setFeedback2Expanded(!feedback2Expanded)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="font-medium text-gray-700">
                View Client Feedback
              </span>
              <span className="material-icons text-gray-500">
                {feedback2Expanded ? "expand_less" : "expand_more"}
              </span>
            </button>
            {feedback2Expanded && (
              <div className="mt-2 rounded-md bg-gray-50 p-3 text-sm text-gray-500">
                Client feedback will be displayed here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
