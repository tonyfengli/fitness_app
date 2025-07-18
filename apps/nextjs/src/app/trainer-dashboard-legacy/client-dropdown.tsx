"use client";

import { useState } from "react";
import { useTRPC } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";

interface Client {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  profile?: {
    strengthLevel: string;
    skillLevel: string;
    notes: string | null;
  } | null;
}

interface ClientDropdownProps {
  onClientSelect?: (client: Client | null) => void;
  className?: string;
  showLevels?: boolean; // Show strength/skill levels in dropdown
}

export default function ClientDropdown({ onClientSelect, className = "", showLevels = true }: ClientDropdownProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const trpc = useTRPC();
  
  // Fetch clients using tRPC
  const { data: clients, isLoading, error } = useQuery(
    trpc.auth.getClientsByBusiness.queryOptions()
  );

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const selectedClient = clients?.find(c => c.id === clientId) || null;
    onClientSelect?.(selectedClient);
  };

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        Error loading clients: {error.message}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor="client-select" className="text-sm font-medium text-gray-700">
        Select Client
      </label>
      <select
        id="client-select"
        value={selectedClientId}
        onChange={(e) => handleClientChange(e.target.value)}
        disabled={isLoading}
        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
      >
        <option value="">
          {isLoading ? "Loading clients..." : "Select a client"}
        </option>
        {clients?.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name || client.email}
            {showLevels && client.profile && (
              ` (Strength: ${client.profile.strengthLevel}, Skill: ${client.profile.skillLevel})`
            )}
            {client.phone && ` - ${client.phone}`}
          </option>
        ))}
      </select>
      {clients && clients.length === 0 && (
        <p className="text-sm text-gray-500">No clients found in your business.</p>
      )}
    </div>
  );
}