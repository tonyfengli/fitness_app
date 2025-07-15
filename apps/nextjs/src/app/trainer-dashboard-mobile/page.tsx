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
    <div className="bg-white min-h-screen">
      {/* Header */}
      <header className="bg-white px-4 py-3 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">My Workouts</h1>
      </header>

      <div className="px-4 py-3">
        {/* Client Profile Card */}
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <div className="flex items-center">
            <img 
              alt="Profile picture of Olivia Carter" 
              className="w-12 h-12 rounded-full mr-4" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDIeLmYWb8tK-gWfoQYAw7zpYbgwOaL-OGsdGtWkQBk4FVgbbUQex4_BQpvdxAFU5xokk29v881Ypk2wLBiLx-0QY09DZdSCvNqkW0CVGdw8sc9citoSEW2KJBpJEsgs0bG8IIDDcbn7dXk7DZZHAtq-NGvFSqscNAi3TtQUCXYhuuR3kRLD92fDCVwyxcXIxyoZPifxTGlZQFEGO92YZYWtxF_anZ0zF5OmpZjvC-rmW0mV7lVFsA7-O_J5PiK_UxqpvpJUaHuZvEt"
            />
            <div>
              <h2 className="font-semibold text-lg text-gray-900">Olivia Carter</h2>
              <p className="text-gray-600 text-sm">Strength Training</p>
            </div>
          </div>
        </div>

        {/* Workout Program 1 */}
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

          {/* Feedback Section */}
          <div className="pt-4 mt-6">
            <button 
              onClick={() => setFeedback1Expanded(!feedback1Expanded)}
              className="w-full flex justify-between items-center text-left"
            >
              <span className="font-medium text-gray-700">View Client Feedback</span>
              <span className="material-icons text-gray-500">
                {feedback1Expanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {feedback1Expanded && (
              <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                Client feedback will be displayed here.
              </div>
            )}
          </div>

        </div>

        <div className="border-t border-gray-200 my-6"></div>

        {/* Workout Program 2 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-800">Workout Program - 2024-07-22</h3>
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
              <span className="material-icons text-base mr-1">edit</span>
              Edit
            </button>
          </div>
          
          <div className="space-y-3">
            {mockExercises2.map((exercise) => (
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

          {/* Feedback Section */}
          <div className="pt-4 mt-6">
            <button 
              onClick={() => setFeedback2Expanded(!feedback2Expanded)}
              className="w-full flex justify-between items-center text-left"
            >
              <span className="font-medium text-gray-700">View Client Feedback</span>
              <span className="material-icons text-gray-500">
                {feedback2Expanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {feedback2Expanded && (
              <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-md">
                Client feedback will be displayed here.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}