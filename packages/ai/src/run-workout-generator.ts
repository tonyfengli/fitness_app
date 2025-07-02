import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { generateWorkoutFromInput } from "./generateWorkoutFromInput";
import type { Exercise, WorkoutStateType } from "./types";
import { WorkoutGenerationError } from "./nodes/generateWorkoutNode";

// Load environment variables from root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });

/**
 * CLI runner for workout generation - displays formatted results
 * @param userInput - The user's workout request
 * @returns Promise<WorkoutStateType> - The generated workout data
 * @throws {Error} If workout generation fails
 */
export async function runWorkoutGenerator(userInput = "I want to build muscle at home"): Promise<WorkoutStateType> {
  console.log("🏋️ Workout Generator with Database\n");
  
  try {
    const result = await generateWorkoutFromInput(userInput);

    console.log("Input:", result.userInput);
    console.log("\nGenerated Workout Plan:");
    console.log(result.workoutPlan);
    console.log(`\nUsed ${result.exercises.length} exercises from database`);
    
    console.log("\nSelected Exercises:");
    result.exercises.forEach((ex: Exercise, idx: number) => {
      console.log(`${idx + 1}. ${ex.name} (${ex.primaryMuscle}) - ${ex.equipment?.join(', ') ?? 'bodyweight'}`);
    });

    return result;
  } catch (error) {
    if (error instanceof WorkoutGenerationError) {
      console.error("\n❌ Workout Generation Error:", error.message);
      if (error.cause) {
        console.error("Caused by:", error.cause);
      }
    } else {
      console.error("\n❌ Unexpected Error:", error);
    }
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runWorkoutGenerator()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\nFailed to generate workout");
      process.exit(1);
    });
}