"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

// Types for our app state
interface Client {
  id: string;
  name: string;
  program: string;
  avatar?: string;
}

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps?: number | string;
  duration?: string;
}

interface Workout {
  id: string;
  clientId: string;
  title: string;
  exercises: Exercise[];
  date?: string;
}

interface AppState {
  // Client state
  clients: Client[];
  selectedClientId: string | null;
  
  // Workout state
  workouts: Workout[];
  activeWorkoutId: string | null;
  
  // UI state
  isSidebarOpen: boolean;
  isLoading: boolean;
}

interface AppContextValue extends AppState {
  // Client actions
  selectClient: (clientId: string) => void;
  addClient: (client: Client) => void;
  updateClient: (clientId: string, updates: Partial<Client>) => void;
  
  // Workout actions
  addWorkout: (workout: Workout) => void;
  updateWorkout: (workoutId: string, updates: Partial<Workout>) => void;
  setActiveWorkout: (workoutId: string) => void;
  
  // UI actions
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
}

// Create context
const AppContext = createContext<AppContextValue | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  // Initialize state
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Client actions
  const selectClient = (clientId: string) => {
    setSelectedClientId(clientId);
  };

  const addClient = (client: Client) => {
    setClients(prev => [...prev, client]);
  };

  const updateClient = (clientId: string, updates: Partial<Client>) => {
    setClients(prev => 
      prev.map(client => 
        client.id === clientId ? { ...client, ...updates } : client
      )
    );
  };

  // Workout actions
  const addWorkout = (workout: Workout) => {
    setWorkouts(prev => [...prev, workout]);
  };

  const updateWorkout = (workoutId: string, updates: Partial<Workout>) => {
    setWorkouts(prev =>
      prev.map(workout =>
        workout.id === workoutId ? { ...workout, ...updates } : workout
      )
    );
  };

  const setActiveWorkout = (workoutId: string) => {
    setActiveWorkoutId(workoutId);
  };

  // UI actions
  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const setLoading = (loading: boolean) => {
    setIsLoading(loading);
  };

  const value: AppContextValue = {
    // State
    clients,
    selectedClientId,
    workouts,
    activeWorkoutId,
    isSidebarOpen,
    isLoading,
    
    // Actions
    selectClient,
    addClient,
    updateClient,
    addWorkout,
    updateWorkout,
    setActiveWorkout,
    toggleSidebar,
    setLoading,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook to use the context
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
}

// Export types
export type { Client, Exercise, Workout, AppState, AppContextValue };