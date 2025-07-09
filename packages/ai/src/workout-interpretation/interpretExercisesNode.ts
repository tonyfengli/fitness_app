import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { WorkoutInterpretationStateType, ExercisesByBlock, TopExercise } from "./types";
import { determineTotalSetCount } from "./setCountLogic";

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
    
    // Build the system prompt
    const systemPrompt = `You are a workout programmer. Given the TOP exercises for each block, create a workout routine.

## Rules
Your goal is to design a personalized, cohesive workout that:
- Aligns with the client's session goal and preferred intensity.
- Reflects the client's strength and skill levels throughout the programming (exercise order, volume, complexity).
- Includes any requested exercises, force it in
- Maintains balanced movement patterns, variety in fatigue profiles and modalities, and a logical flow between blocks.

## Context
You are provided with pre-filtered TOP exercises for each training block. Each exercise has been scored and selected based on the client's requirements.

Exercise data includes:
- name: Exercise name
- score: Selection priority (higher = better match)
- tags: Function tags indicating exercise type and movement pattern
- primaryMuscle: Main muscle group targeted
- equipment: Required equipment

Client context may include:
- sessionGoal: Training focus (strength or stability)
- strengthLevel: Client's strength capacity
- skillLevel: Client's technical ability
- intensity: Desired session intensity
- includeExercises: Specific exercises requested
- muscleTarget: Muscles to emphasize
- muscleLessen: Muscles to avoid/reduce load

## Constraints
Distribute the provided totalSetRange across all blocks in a way that aligns with the client's session goal and preferred intensity.

Decide how many sets to assign per block based on:
- The block's role (e.g., primary strength vs accessory work).
- The relative intensity of each exercise (higher intensity = fewer sets).
- The total number of sets must remain within the provided range (never exceed or fall short).
- Do not assign fewer sets than the minimum per block if it results in falling below the total set range.

Exercise selection constraints:
- Block A: Select exactly 1 exercise with 3-4 sets
- IMPORTANT: Maximum 8 exercises TOTAL across ALL blocks (no more than 8)
- This means you have 7 exercises remaining to distribute across blocks B, C, and D
- Count carefully: Block A (1) + Block B + Block C + Block D must equal 8 or fewer exercises

## Output Format
Return a JSON object with this structure:
{
  "blockA": [{"exercise": "exercise name", "sets": number}],
  "blockB": [{"exercise": "exercise name", "sets": number}],
  "blockC": [{"exercise": "exercise name", "sets": number}],
  "blockD": [{"exercise": "exercise name", "sets": number}],
  "reasoning": "Your explanation for why you selected each exercise AND state the total set range provided"
}

## Examples
[Empty - to be filled later]

Select exercises for each block and assign sets. In your reasoning, include:
1. Why you selected each exercise
2. How you distributed the total sets across blocks
3. Confirm the total adds up to a number within the provided range`;

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