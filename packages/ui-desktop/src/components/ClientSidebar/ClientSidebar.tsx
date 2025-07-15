import React from "react";
import type { ClientSidebarProps } from "./ClientSidebar.types";
import { cn, Avatar, Button } from "@acme/ui-shared";

export function ClientSidebar({
  clients,
  selectedClientId,
  onClientSelect,
  onAddNewClient,
  className,
}: ClientSidebarProps) {
  return (
    <div className={cn("w-80 bg-white border-r border-gray-200 p-6 flex flex-col", className)}>


      {/* Clients Header */}
      <h2 className="text-lg font-semibold mb-4">Clients</h2>

      {/* Client List */}
      <div className="flex-grow">
        {clients.map((client) => (
          <button
            key={client.id}
            onClick={() => onClientSelect?.(client)}
            className={cn(
              "flex items-center p-3 rounded-lg mb-2 w-full text-left transition-colors",
              selectedClientId === client.id
                ? "bg-indigo-100"
                : "hover:bg-gray-100"
            )}
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
        ))}
      </div>

      {/* Add New Client Button */}
      <div className="mt-auto">
        <Button
          onClick={onAddNewClient}
          className="w-full flex items-center justify-center"
          variant="primary"
        >
          <span className="material-icons text-[18px] mr-2">add</span>
          <span>Add New Client</span>
        </Button>
      </div>
    </div>
  );
}