import React from "react";
import type { ClientSidebarProps } from "./ClientSidebar.types";
import { cn, Avatar } from "@acme/ui-shared";

export function ClientSidebar({
  clients,
  selectedClientId,
  onClientSelect,
  onAddNewClient,
  className,
}: ClientSidebarProps) {
  return (
    <nav 
      className={cn("w-80 bg-white p-6 flex flex-col", className)}
      aria-label="Client navigation"
    >
      {/* Clients Header */}
      <h2 className="text-lg font-semibold mb-4">Clients</h2>

      {/* Client List */}
      <ul className="flex-grow" role="list">
        {clients.map((client) => (
          <li key={client.id} role="listitem">
            <button
              onClick={() => onClientSelect?.(client)}
              className={cn(
                "flex items-center p-3 rounded-lg mb-2 w-full text-left transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                selectedClientId === client.id
                  ? "bg-indigo-100"
                  : "hover:bg-gray-100"
              )}
              aria-selected={selectedClientId === client.id}
              aria-label={`Select ${client.name}, ${client.program}`}
            >
              <Avatar
                src={client.avatar}
                alt={client.name}
                fallback={client.name.charAt(0)}
                size="md"
              />
              <div className="ml-4">
                <p className="font-semibold text-gray-900">{client.name}</p>
                <p className="text-sm text-gray-600">{client.program}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}