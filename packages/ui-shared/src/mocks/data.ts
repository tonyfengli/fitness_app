import type { Client, Exercise, Workout } from "../context/AppContext";

// Mock Exercises
export const mockExercises: Exercise[] = [
  { id: "1", name: "Barbell Back Squat", sets: 5, reps: "5" },
  { id: "2", name: "Romanian Deadlift", sets: 4, reps: "8" },
  { id: "3", name: "Walking Lunges", sets: 3, reps: "12 each leg" },
  { id: "4", name: "Bench Press", sets: 4, reps: "8" },
  { id: "5", name: "Pull-ups", sets: 3, reps: "10" },
  { id: "6", name: "Dumbbell Shoulder Press", sets: 3, reps: "12" },
];

// Mock Clients
export const mockClients: Client[] = [
  {
    id: "1",
    name: "Emma Thompson",
    program: "Weight Loss",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma",
  },
  {
    id: "2",
    name: "James Wilson",
    program: "Muscle Building",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=James",
  },
  {
    id: "3",
    name: "Sophia Davis",
    program: "Athletic Performance",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia",
  },
  {
    id: "4",
    name: "Michael Chen",
    program: "General Fitness",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael",
  },
  {
    id: "5",
    name: "Olivia Brown",
    program: "Post-Injury Recovery",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Olivia",
  },
];

// Mock Client Exercise Data (for workout overview)
export interface ClientWorkoutData {
  id: string;
  name: string;
  avatar?: string;
  exercises: Array<{ name: string; sets: number }>;
}

export const mockClientWorkouts: ClientWorkoutData[] = [
  {
    id: "1",
    name: "Emma Thompson",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma",
    exercises: [
      { name: "Squats", sets: 3 },
      { name: "Lunges", sets: 3 },
      { name: "Leg Press", sets: 4 },
    ],
  },
  {
    id: "2",
    name: "James Wilson", 
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=James",
    exercises: [
      { name: "Bench Press", sets: 4 },
      { name: "Incline Dumbbell Press", sets: 3 },
      { name: "Cable Flyes", sets: 3 },
    ],
  },
  {
    id: "3",
    name: "Sophia Davis",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia",
    exercises: [
      { name: "Deadlifts", sets: 5 },
      { name: "Pull-ups", sets: 4 },
      { name: "Barbell Rows", sets: 4 },
    ],
  },
  {
    id: "4",
    name: "Michael Chen",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael",
    exercises: [
      { name: "Overhead Press", sets: 4 },
      { name: "Lateral Raises", sets: 3 },
      { name: "Face Pulls", sets: 3 },
    ],
  },
  {
    id: "5",
    name: "Olivia Brown",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Olivia",
    exercises: [
      { name: "Leg Curls", sets: 3 },
      { name: "Calf Raises", sets: 4 },
      { name: "Hip Thrusts", sets: 3 },
    ],
  },
  {
    id: "6",
    name: "Daniel Kim",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel",
    exercises: [
      { name: "Bicep Curls", sets: 3 },
      { name: "Tricep Extensions", sets: 3 },
      { name: "Hammer Curls", sets: 3 },
    ],
  },
];

// Mock Users for Session Lobby
export interface SessionUser {
  id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'in-session' | 'offline';
  lastSeen?: string;
}

export const mockSessionUsers: SessionUser[] = [
  { 
    id: "1", 
    name: "Emma Thompson", 
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma",
    status: 'online' 
  },
  { 
    id: "2", 
    name: "James Wilson", 
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=James",
    status: 'in-session' 
  },
  { 
    id: "3", 
    name: "Sophia Davis", 
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia",
    status: 'offline', 
    lastSeen: '5 mins ago' 
  },
  { 
    id: "4", 
    name: "Michael Chen", 
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael",
    status: 'online' 
  },
  { 
    id: "5", 
    name: "Olivia Brown", 
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Olivia",
    status: 'in-session' 
  },
  { 
    id: "6", 
    name: "Daniel Kim", 
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel",
    status: 'offline', 
    lastSeen: '2 hours ago' 
  },
];

// Mock Workouts
export const mockWorkouts: Workout[] = [
  {
    id: "1",
    title: "Full Body Strength",
    clientId: "1",
    exercises: mockExercises.slice(0, 3),
    date: "2024-01-15",
  },
  {
    id: "2",
    title: "Upper Body Focus",
    clientId: "2",
    exercises: mockExercises.slice(3, 6),
    date: "2024-01-14",
  },
];

// Exercise categories for mobile add exercise
export const exerciseCategories = [
  {
    name: "Chest",
    exercises: [
      "Bench Press",
      "Incline Dumbbell Press",
      "Cable Flyes",
      "Push-ups",
      "Dips",
    ],
  },
  {
    name: "Back",
    exercises: [
      "Deadlifts",
      "Pull-ups",
      "Barbell Rows",
      "Lat Pulldowns",
      "T-Bar Rows",
    ],
  },
  {
    name: "Legs",
    exercises: [
      "Squats",
      "Romanian Deadlifts",
      "Leg Press",
      "Lunges",
      "Leg Curls",
    ],
  },
  {
    name: "Shoulders",
    exercises: [
      "Overhead Press",
      "Lateral Raises",
      "Face Pulls",
      "Upright Rows",
      "Rear Delt Flyes",
    ],
  },
];