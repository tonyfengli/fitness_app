"use client";

import { useAppContext } from "./AppContext";

/**
 * Hook to access client-related state and actions
 */
export function useClients() {
  const {
    clients,
    selectedClientId,
    selectClient,
    addClient,
    updateClient,
  } = useAppContext();

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return {
    clients,
    selectedClient,
    selectedClientId,
    selectClient,
    addClient,
    updateClient,
  };
}

/**
 * Hook to access workout-related state and actions
 */
export function useWorkouts() {
  const {
    workouts,
    activeWorkoutId,
    addWorkout,
    updateWorkout,
    setActiveWorkout,
  } = useAppContext();

  const activeWorkout = workouts.find(w => w.id === activeWorkoutId);

  return {
    workouts,
    activeWorkout,
    activeWorkoutId,
    addWorkout,
    updateWorkout,
    setActiveWorkout,
  };
}

/**
 * Hook to access UI state
 */
export function useUI() {
  const {
    isSidebarOpen,
    isLoading,
    toggleSidebar,
    setLoading,
  } = useAppContext();

  return {
    isSidebarOpen,
    isLoading,
    toggleSidebar,
    setLoading,
  };
}