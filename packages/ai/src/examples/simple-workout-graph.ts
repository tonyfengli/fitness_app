import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { config } from "dotenv";
import { resolve } from "path";
import { db } from "@acme/db/client";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../../../../.env") });

// Simple state with just input and output
interface Exercise {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[] | null;
  loadedJoints: string[] | null;
  movementPattern: string;
  modality: string;
  movementTags: string[] | null;
  functionTags: string[] | null;
  fatigueProfile: string;
  complexityLevel: string;
  equipment: string[] | null;
  strengthLevel: string;
  createdAt: Date;
}

// Define state using the new annotation API
const WorkoutState = Annotation.Root({
  userInput: Annotation<string>,
  workoutPlan: Annotation<string>,
  exercises: Annotation<Exercise[]>
});

// Helper function to fetch all exercises from database
async function getAllExercises(): Promise<Exercise[]> {
  return await db.query.exercises.findMany() as Exercise[];
}

// Helper function to randomly select exercises by muscle groups
function selectRandomExercisesByMuscles(exercises: Exercise[], primaryMuscles: string[], count: number = 3): Exercise[] {
  const filtered = exercises.filter(ex => primaryMuscles.includes(ex.primaryMuscle));
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Helper function to format workout plan with exercises
function formatWorkoutPlan(pushExercises: Exercise[], pullExercises: Exercise[], legExercises: Exercise[]): string {
  const formatExerciseList = (exercises: Exercise[]) => 
    exercises.map(ex => `- ${ex.name} (${ex.equipment?.join(', ') || 'bodyweight'}): 3 sets of 8-12`).join('\n');

  return `Day 1: Push (Chest, Shoulders, Triceps)
${formatExerciseList(pushExercises)}

Day 2: Pull (Back, Biceps)
${formatExerciseList(pullExercises)}

Day 3: Legs
${formatExerciseList(legExercises)}`;
}

// Create a simple workout planning graph
export function createSimpleWorkoutGraph() {

  // Single node to generate workout
  async function generateWorkout(state: typeof WorkoutState.State) {
    // Fetch all exercises from database
    const allExercises = await getAllExercises();
    
    // Select random exercises for each muscle group
    const pushExercises = selectRandomExercisesByMuscles(allExercises, ['chest', 'shoulders', 'triceps'], 3);
    const pullExercises = selectRandomExercisesByMuscles(allExercises, ['lats', 'biceps', 'upper_back'], 3);
    const legExercises = selectRandomExercisesByMuscles(allExercises, ['quads', 'glutes', 'hamstrings'], 3);
    
    // Format the workout plan
    const workoutPlan = formatWorkoutPlan(pushExercises, pullExercises, legExercises);

    return {
      workoutPlan,
      exercises: [...pushExercises, ...pullExercises, ...legExercises],
    };
  }

  // Build the graph using the new annotation API
  const workflow = new StateGraph(WorkoutState);

  // Add single node
  workflow.addNode("workout", generateWorkout);
  
  // Set flow using modern API
  // @ts-ignore - LangGraph v0.3 types are still being refined
  workflow.addEdge(START, "workout");
  // @ts-ignore - LangGraph v0.3 types are still being refined  
  workflow.addEdge("workout", END);

  return workflow.compile();
}

// Run example with database integration
export async function runExample() {
  console.log("🏋️ Workout Graph Example with Database\n");
  
  const app = createSimpleWorkoutGraph();
  
  const result = await app.invoke({
    userInput: "I want to build muscle at home",
    workoutPlan: "",
    exercises: undefined,
  });

  console.log("Input:", result.userInput);
  console.log("\nGenerated Workout Plan:");
  console.log(result.workoutPlan);
  console.log(`\nUsed ${result.exercises.length} exercises from database`);
  
  console.log("\nSelected Exercises:");
  result.exercises.forEach((ex: Exercise, idx: number) => {
    console.log(`${idx + 1}. ${ex.name} (${ex.primaryMuscle}) - ${ex.equipment?.join(', ') ?? 'bodyweight'}`);
  });

  return result;
}