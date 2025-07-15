"use client";

import React from "react";
import { AppProvider, useClients, useUI } from "@acme/ui-shared";
import { SidebarLayout, ClientSidebar } from "@acme/ui-desktop";

// Main dashboard component that uses the state
function DashboardContent() {
  const { clients, selectedClient, selectClient, addClient } = useClients();
  const { isSidebarOpen } = useUI();

  // Example: Add mock clients on mount
  React.useEffect(() => {
    if (clients.length === 0) {
      // Add some example clients
      addClient({
        id: "1",
        name: "John Doe",
        program: "Strength Training",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
      });
      addClient({
        id: "2",
        name: "Jane Smith",
        program: "Weight Loss",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jane",
      });
    }
  }, [clients.length, addClient]);

  return (
    <SidebarLayout
      sidebar={
        isSidebarOpen ? (
          <ClientSidebar
            clients={clients}
            selectedClientId={selectedClient?.id}
            onClientSelect={(client) => selectClient(client.id)}
            onAddNewClient={() => {
              const newClient = {
                id: Date.now().toString(),
                name: `Client ${clients.length + 1}`,
                program: "General Fitness",
              };
              addClient(newClient);
            }}
          />
        ) : null
      }
    >
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">
          Dashboard with State Management
        </h1>
        
        {selectedClient ? (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2">
              Selected Client: {selectedClient.name}
            </h2>
            <p className="text-gray-600">
              Program: {selectedClient.program}
            </p>
          </div>
        ) : (
          <div className="bg-gray-100 p-6 rounded-lg">
            <p className="text-gray-600">
              Select a client from the sidebar to view details
            </p>
          </div>
        )}
        
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-2">State Info:</h3>
          <p className="text-sm text-gray-600">
            Total Clients: {clients.length}
          </p>
          <p className="text-sm text-gray-600">
            Sidebar: {isSidebarOpen ? "Open" : "Closed"}
          </p>
        </div>
      </div>
    </SidebarLayout>
  );
}

// Root component with provider
export default function DashboardWithState() {
  return (
    <AppProvider>
      <DashboardContent />
    </AppProvider>
  );
}