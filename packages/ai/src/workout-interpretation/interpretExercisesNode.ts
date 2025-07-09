import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { WorkoutInterpretationStateType, ExercisesByBlock, TopExercise } from "./types";
import { determineTotalSetCount } from "./setCountLogic";
import { WorkoutPromptBuilder } from "./prompts/workoutInterpretationPrompt";

// Initialize the LLM - using gpt-4o for speed and cost efficiency
const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.3, // Lower temperature for more consistent JSON output
});

/**
 * Single node that interprets the TOP exercises using LLM
 */
export async function interpretExercisesNode(
  state: WorkoutInterpretationStateType
): Promise<Partial<WorkoutInterpretationStateType>> {
  try {
    const { exercises, clientContext } = state;
    
    // Validate input
    if (!exercises || Object.keys(exercises).length === 0) {
      return {
        error: "No exercises provided for interpretation",
      };
    }

    // Format exercises for the prompt
    const formattedExercises = formatExercisesForPrompt(exercises);
    
    // Calculate set count based on client context
    const setCount = determineTotalSetCount({
      strengthLevel: clientContext?.strengthLevel,
      intensity: clientContext?.intensity
    });
    
    // Build the system prompt - can be customized based on client context
    const promptBuilder = new WorkoutPromptBuilder({
      // Enable strict exercise limit if client has specific requirements
      strictExerciseLimit: clientContext?.strictExerciseCount === true,
      // Emphasize requested exercises if they're provided
      emphasizeRequestedExercises: clientContext?.includeExercises?.length > 0,
      // Don't include examples by default (keeps prompt shorter)
      includeExamples: false
    });
    
    const systemPrompt = promptBuilder.build();

    // Build the user message
    const userMessage = `Here are the TOP exercises selected for each block:

${formattedExercises}

${clientContext && Object.keys(clientContext).length > 0 
  ? `\nClient Context:\n${JSON.stringify(clientContext, null, 2)}` 
  : ''}

Total Set Range: ${setCount.minSets}-${setCount.maxSets} sets
${setCount.reasoning}

Please interpret these exercises according to the system instructions.`;

    // Call the LLM
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userMessage),
    ]);

    const interpretation = response.content.toString();

    // Parse JSON response
    let structuredOutput;
    try {
      // Extract JSON from the response (in case LLM adds extra text)
      const jsonMatch = interpretation.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        structuredOutput = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON object found in response");
      }
    } catch (parseError) {
      console.error("Error parsing LLM response as JSON:", parseError);
      structuredOutput = { error: "Failed to parse response as JSON", raw: interpretation };
    }

    return {
      interpretation,
      structuredOutput,
    };
  } catch (error) {
    console.error("Error in interpretExercisesNode:", error);
    return {
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Helper function to format exercises for the prompt
 */
function formatExercisesForPrompt(exercises: ExercisesByBlock): string {
  const blocks = ["blockA", "blockB", "blockC", "blockD"];
  let formatted = "";

  for (const block of blocks) {
    const blockKey = block as keyof ExercisesByBlock;
    if (exercises[blockKey] && exercises[blockKey].length > 0) {
      formatted += `\n${block.toUpperCase()}:\n`;
      exercises[blockKey].forEach((ex: TopExercise, idx: number) => {
        formatted += `${idx + 1}. ${ex.name} (Score: ${ex.score})\n`;
        if (ex.tags && ex.tags.length > 0) {
          formatted += `   Tags: ${ex.tags.join(", ")}\n`;
        }
        if (ex.primaryMuscle) {
          formatted += `   Primary: ${ex.primaryMuscle}\n`;
        }
      });
    }
  }

  return formatted.trim();
}