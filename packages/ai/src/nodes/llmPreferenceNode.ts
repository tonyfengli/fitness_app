import type { WorkoutRoutineStateType, ClientContext, RoutineTemplate, Exercise } from "../types";
import { openAILLM, validateOpenAIConfig } from "../utils/llm";

export class LLMPreferenceError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'LLMPreferenceError';
  }
}

interface ScoredExercise {
  exercise_id: string;
  name: string;
  score: number;
  reasons: string[];
}

/**
 * Score exercises using OpenAI LLM based on client context and routine template
 */
async function scoreExercisesWithLLM(
  exercises: Exercise[],
  clientContext: ClientContext,
  routineTemplate: RoutineTemplate,
  _userInput?: string
): Promise<Exercise[]> {
  // Limit the number of exercises to prevent timeout
  const MAX_EXERCISES = 50;
  const exercisesToScore = exercises.slice(0, MAX_EXERCISES);
  
  // Build the scoring prompt
  const prompt = `You are ranking a list of pre-filtered exercises based on a client's fitness profile and the current session goal.

Each exercise has metadata including: primary and secondary muscles, movement patterns, fatigue profile, and tags.

Your goal is to return a ranked list of exercises, from most relevant to least relevant, using the inputs below.

---

**Client Goal (long-term):** ${clientContext.primary_goal ?? 'general_fitness'}

**Session Goal:** ${routineTemplate.routine_goal ?? clientContext.primary_goal ?? 'general_fitness'}

(Use 80% weight for session goal if present; otherwise fall back entirely on client goal.)

**Client Intensity:** ${clientContext.intensity ?? 'moderate_local'}

**Session Intensity:** ${routineTemplate.routine_intensity ?? 'moderate_local'}

(Weight: 30% client, 70% session)

**Client Muscle Focus:** ${clientContext.muscle_target?.join(', ') ?? 'none specified'}

**Session Muscle Focus:** ${routineTemplate.muscle_target.join(', ') ?? 'none specified'}

(Weight: 70% client, 30% session)

**Client Muscle Lessen:** ${clientContext.muscle_lessen?.join(', ') ?? 'none specified'}

(Deprioritize exercises using these muscles, but do not exclude.)

---

**Exercises to rank:**
${JSON.stringify(exercisesToScore, null, 2)}

---

For each exercise, return:

- \`exercise_id\` (use the exercise's id field)
- \`name\`
- \`score\` (between 0–10)
- \`reasons\` (array of why it ranked where it did)

Only use the provided exercise list.
Rank them based on how well they match the blended context.
Do not select a fixed number. Just score and sort.

Respond only with a valid JSON array. Do not include any markdown formatting, explanations, or code blocks. Return ONLY the raw JSON array like this:
[
{
"exercise_id": "...",
"name": "Barbell Back Squat",
"score": 8.9,
"reasons": [
"matches primary goal: hypertrophy",
"targets client-preferred muscle group: glutes",
"fatigue profile aligns with moderate intensity"
]
},
...
]`;

  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI request timed out after 30 seconds')), 30000);
    });
    
    const response = await Promise.race([
      openAILLM.invoke(prompt),
      timeoutPromise
    ]);
    
    const responseText = response.content as string;
    
    // Clean the response text - remove markdown code blocks if present
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Parse the JSON response
    let scoredExercises: ScoredExercise[];
    try {
      scoredExercises = JSON.parse(cleanedResponse) as ScoredExercise[];
    } catch (parseError) {
      console.error('❌ JSON parsing failed. Raw response:', responseText);
      console.error('❌ Cleaned response:', cleanedResponse);
      throw new Error(`Failed to parse OpenAI response as JSON: ${parseError}`);
    }
    
    // Create a map of scored exercises by ID for quick lookup
    const scoreMap = new Map<string, ScoredExercise>();
    scoredExercises.forEach(scored => {
      scoreMap.set(scored.exercise_id, scored);
    });
    
    // Sort scored exercises first, then append unscored ones
    const scoredExercisesWithData = exercisesToScore
      .map(exercise => {
        const scored = scoreMap.get(exercise.id);
        return {
          exercise,
          score: scored?.score ?? 0,
          reasons: scored?.reasons ?? []
        };
      })
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .map(item => ({
        ...item.exercise,
        llmScore: item.score,
        llmReasons: item.reasons
      }));
    
    // Add any remaining unscored exercises at the end
    const unscoredExercises = exercises.slice(MAX_EXERCISES);
    const sortedExercises = [...scoredExercisesWithData, ...unscoredExercises];
    
    return sortedExercises;
    
  } catch (error) {
    console.error('❌ LLM scoring failed:', error);
    throw new LLMPreferenceError('Failed to score exercises with LLM', error);
  }
}

/**
 * LangGraph node that applies LLM-based preference scoring to exercises
 * Uses AI to score and soft-filter exercises based on user preferences and context
 * @param state - Current workflow state containing filtered exercises from rulesBasedFilterNode
 * @returns Updated state with LLM-scored and preference-filtered exercises
 * @throws {LLMPreferenceError} If LLM processing fails
 */
export async function llmPreferenceNode(state: WorkoutRoutineStateType) {
  try {
    console.log('🤖 llmPreferenceNode called');
    // Extract data from state
    const { 
      filteredExercises, 
      userInput,
      clientContext,
      routineTemplate 
    } = state;
    
    if (!filteredExercises || filteredExercises.length === 0) {
      throw new LLMPreferenceError('No filtered exercises available for LLM preference scoring');
    }
    
    
    // Check if OpenAI is configured and apply LLM scoring
    try {
      validateOpenAIConfig();
      // Apply LLM-based exercise scoring
      const scoredExercises = await scoreExercisesWithLLM(filteredExercises, clientContext, routineTemplate, userInput);
      
      // Log what we're returning
      console.log('✅ llmPreferenceNode returning:', {
        exerciseCount: scoredExercises.length,
        topExercises: scoredExercises.slice(0, 3).map(ex => ({
          name: ex.name,
          score: ex.llmScore,
          reasons: ex.llmReasons?.length || 0
        })),
        hasScoring: scoredExercises.some(ex => ex.llmScore !== undefined)
      });
      
      return {
        ...state,
        filteredExercises: scoredExercises,
      };
      
    } catch (error) {
      console.error('⚠️ LLM scoring error (falling back to pass-through):', error);
      
      // Log fallback return
      console.log('📤 llmPreferenceNode returning (pass-through):', {
        exerciseCount: filteredExercises.length,
        topExercises: filteredExercises.slice(0, 3).map(ex => ({
          name: ex.name,
          score: ex.llmScore || 'none',
          reasons: ex.llmReasons?.length || 0
        })),
        hasScoring: false,
        mode: 'pass-through (no LLM scoring)'
      });
      
      // Fallback: pass through exercises unchanged
      return {
        ...state,
        filteredExercises: filteredExercises,
      };
    }
  } catch (error) {
    // Re-throw known errors without wrapping
    if (error instanceof LLMPreferenceError) {
      throw error;
    }
    
    // Wrap unknown errors with context
    throw new LLMPreferenceError(
      'Unexpected error during LLM preference processing',
      error
    );
  }
}