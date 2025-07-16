"use client";

import React from "react";
import { PlayerListItem } from "@acme/ui-desktop";
import type { PlayerStatus } from "@acme/ui-desktop";

const mockPlayers = [
  {
    id: "1",
    name: "Sophia Clark",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia",
    status: "online" as PlayerStatus,
    level: 5,
    description: "Idle in the main lobby, waiting for friends to join the party.",
  },
  {
    id: "2",
    name: "Ethan Bennett",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ethan",
    status: "in-match" as PlayerStatus,
    level: 10,
    description: "Current Game: Conquest. Dominating the battlefield.",
  },
  {
    id: "3",
    name: "Olivia Harper",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Olivia",
    status: "online" as PlayerStatus,
    level: 8,
    description: "Idle, checking out the latest item shop cosmetics.",
  },
  {
    id: "4",
    name: "Liam Foster",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Liam",
    status: "in-match" as PlayerStatus,
    level: 12,
    description: "Current Game: Team Deathmatch. Clutching the win for the team.",
  },
  {
    id: "5",
    name: "Ava Mitchell",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ava",
    status: "online" as PlayerStatus,
    level: 7,
    description: "Idle, customizing her character's loadout for the next game.",
  },
];

export default function SessionLobby() {
  return (
    <div className="bg-white font-sans">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6"></div>
        
        <main className="mt-4">
          <div className="text-center">
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-12 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 text-lg inline-flex items-center justify-center">
              Play
            </button>
          </div>
          
          <div className="mt-16 max-w-3xl mx-auto">
            <div className="space-y-6">
              {mockPlayers.map((player) => (
                <PlayerListItem
                  key={player.id}
                  name={player.name}
                  avatar={player.avatar}
                  status={player.status}
                  level={player.level}
                  description={player.description}
                  onEdit={() => console.log(`Edit ${player.name}`)}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}