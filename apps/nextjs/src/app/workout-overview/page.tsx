"use client";

import React from "react";
import { AppHeader, ClientWorkoutCard } from "@acme/ui-desktop";
import { mockClientWorkouts } from "@acme/ui-shared";

export default function WorkoutOverview() {
  const navItems = [
    { label: "Dashboard", href: "#" },
    { label: "Workouts", href: "#", active: true },
    { label: "Progress", href: "#" },
    { label: "Community", href: "#" },
  ];

  return (
    <div className="bg-gray-50 text-gray-800 min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-10"></div>

        <main>
          <h1 className="text-5xl font-bold mb-12 text-gray-900">Workout Overview</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {mockClientWorkouts.map((client) => (
              <ClientWorkoutCard
                key={client.id}
                clientName={client.name}
                clientAvatar={client.avatar}
                exercises={client.exercises}
                onQRCodeClick={() => console.log(`QR code clicked for ${client.name}`)}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}