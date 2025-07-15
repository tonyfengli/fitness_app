"use client";

import React from "react";
import { AppHeader, UserStatusCard } from "@acme/ui-desktop";
import { Button, mockSessionUsers } from "@acme/ui-shared";

export default function SessionLobby() {
  const navItems = [
    { label: "Dashboard", href: "#" },
    { label: "Workouts", href: "#" },
    { label: "Progress", href: "#" },
    { label: "Community", href: "#" },
  ];

  return (
    <div className="bg-gray-50 text-gray-800 min-h-screen">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-10"></div>

        <main>
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Session Lobby</h1>
            <div className="flex gap-4">
              <Button variant="ghost">Refresh</Button>
              <Button>Start Session</Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockSessionUsers.map((user) => (
              <UserStatusCard
                key={user.id}
                userName={user.name}
                userAvatar={user.avatar}
                status={user.status}
                lastSeen={user.lastSeen}
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}