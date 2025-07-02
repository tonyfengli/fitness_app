import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createWorkoutGraph } from "./graph";
import type { Exercise } from "./types";

// Load environment variables from root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });

/**
 * Runs the workout generation graph and displays results
 * @returns Promise<WorkoutResult> - The generated workout data
 */
export async function runWorkoutGenerator() {
  console.log("🏋️ Workout Generator with Database\n");
  
  const app = createWorkoutGraph();
  
  const result = await app.invoke({
    userInput: "I want to build muscle at home",
    workoutPlan: "",
    exercises: [],
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

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runWorkoutGenerator().catch(console.error);
}