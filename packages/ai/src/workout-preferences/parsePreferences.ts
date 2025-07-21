import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'test-key',
});

// Schema for the parsed preferences
const PreferenceSchema = z.object({
  intensity: z.enum(["low", "moderate", "high"]).optional(),
  muscleTargets: z.array(z.string()).optional(),
  muscleLessens: z.array(z.string()).optional(),
  includeExercises: z.array(z.string()).optional(),
  avoidExercises: z.array(z.string()).optional(),
  avoidJoints: z.array(z.string()).optional(),
  sessionGoal: z.enum(["strength", "stability"]).nullable().optional(),
  generalNotes: z.string().optional(),
  needsFollowUp: z.boolean().describe("Whether the response needs clarification or follow-up questions"),
});

export type ParsedPreferences = z.infer<typeof PreferenceSchema> & {
  systemPromptUsed?: string;
  rawLLMResponse?: any;
  debugInfo?: any;
};

const SYSTEM_PROMPT = `You are an AI assistant helping a fitness trainer prepare workouts for clients. After a client checks in, they send a short message about how they're feeling and any preferences for their workout.

Your job is to carefully extract structured data from their message and return it as JSON. Always extract whatever information you can find, using both explicit statements and implicit cues.

KEY PRINCIPLES:
- Extract muscle/joint mentions even from casual statements like "hamstrings are sore"
- Only use needsFollowUp=true if you truly cannot extract ANY useful preferences
- Omit intensity field if there are no clear intensity indicators (don't default to moderate)
- Do NOT infer muscle targets from exercise requests. Only add to muscleTargets when the user explicitly mentions wanting to work/target/focus on specific muscle groups

IMPORTANT: When users mention specific joint issues (knees, shoulders, etc.) but still request high intensity, honor BOTH:
- Add the joint to avoidJoints for protection
- Keep the requested intensity level (don't automatically reduce to low)

If the client's message is vague, ambiguous, or provides mixed/conflicting signals, set needsFollowUp=true. Otherwise, keep needsFollowUp=false.

Return your response as a JSON object with the extracted preferences.

EXTRACTION FIELDS:
1. sessionGoal → Client's goal for the session
   - Valid options: "strength", "stability", null
   
2. intensity → Overall intensity level  
   - Valid options: "low", "moderate", "high"
   - IMPORTANT: Only include intensity if there are clear intensity indicators in the message
   - DO NOT default to "moderate" - omit the field entirely if no intensity is mentioned
   
3. muscleTargets → Muscle groups the client EXPLICITLY wants to target
   - Only add when user says things like "let's work legs", "focus on chest", "target glutes"
   - Do NOT infer from exercise mentions (e.g., "deadlifts" does not mean add legs/glutes)
   - Valid options: chest, back, shoulders, arms, legs, glutes, core, triceps, biceps, quads, hamstrings, calves
   
4. muscleLessens → Muscle groups that are sore or fatigued
   - Valid options: Same as muscleTargets
   
5. includeExercises → Specific exercises the client requests to include
   - Must be specific exercise names (e.g., "squats", "bench press", "deadlifts")
   
6. avoidExercises → Specific exercises the client requests to avoid
   - Must be specific exercise names
   
7. avoidJoints → Joints the client wants to protect or avoid stressing
   - Common joints: knees, wrists, shoulders, elbows, ankles, hips, lower back
   
8. needsFollowUp → true if vague/ambiguous; false if useful preferences extracted

DETAILED IMPLICIT MAPPING RULES:

SESSION GOAL MAPPINGS:
Strength Indicators:
- "build strength", "get stronger", "strength work" → sessionGoal="strength"
- "heavy", "heavy weights", "lift heavy", "go heavy" → sessionGoal="strength"
- "PR", "personal record", "max out", "test max" → sessionGoal="strength"
- "power", "explosive", "powerful" → sessionGoal="strength"
- "compound movements", "big lifts" → sessionGoal="strength"

Stability Indicators:
- "balance", "stability", "stabilization" → sessionGoal="stability"
- "joint stability" → sessionGoal="stability"
- "control", "controlled movements", "slow and controlled" → sessionGoal="stability"
- "rehab", "prehab", "recovery work" → sessionGoal="stability"
- "activation", "activate muscles" → sessionGoal="stability"

Default: If no clear goal indicators → sessionGoal=null

INTENSITY MAPPINGS:
Low Intensity Indicators:
- "tired", "exhausted", "wiped out", "drained", "beat", "worn out" → intensity="low"
- "sore all over", "everything hurts", "rough night" → intensity="low"
- "take it easy" (general), "go easy", "light day", "easy session" → intensity="low"
- "not feeling it", "low energy", "dragging" → intensity="low"
- General illness or injury → intensity="low"
- NOTE: "Take it easy on [specific muscle]" does NOT lower overall intensity

Moderate Intensity Indicators:
- "normal", "regular", "standard", "typical" → intensity="moderate"
- "decent", "okay", "alright", "fine" → intensity="moderate"
- Mixed signals (tired + push through) → intensity="moderate"
- NO intensity indicators mentioned → OMIT intensity field entirely (do not default)

High Intensity Indicators:
- "feeling great", "energized", "pumped", "ready to go" → intensity="high"
- "crush it", "push hard", "go heavy", "max out" → intensity="high"
- "feeling strong", "well-rested", "fired up" → intensity="high"
- "bring it on", "let's do this", "all in" → intensity="high"
- "kick my butt", "kick my ass", "destroy me", "wreck me" → intensity="high"
- "push me", "challenge me", "don't hold back" → intensity="high"

MUSCLE GROUP MAPPINGS:
Target Indicators (MUST be explicit):
- "hit [muscle]", "work on [muscle]", "focus on [muscle]" → add to muscleTargets
- "[muscle] day", "train [muscle]", "blast [muscle]" → add to muscleTargets
- "let's do [muscle]", "target [muscle]" → add to muscleTargets
Common aliases:
- "upper body" → [chest, back, shoulders, arms]
- "lower body" → [legs, glutes]
- "arms" → [biceps, triceps]
- "legs" → [quads, hamstrings, calves]

NOT Target Indicators:
- Exercise names alone (deadlifts, squats, bench press, etc.)
- General workout descriptions

Avoidance Indicators:
- "[muscle] is sore/tight/tired" → add to muscleLessens
- "skip [muscle]", "avoid [muscle]", "no [muscle]" → add to muscleLessens
- "[muscle] needs rest", "[muscle] is fried" → add to muscleLessens
- "take it easy on [muscle]", "go light on [muscle]" → add to muscleLessens
- "slight/minor soreness in [muscle]" → add to muscleLessens
- When "legs" is mentioned, consider adding relevant leg muscles (hamstrings, quads, glutes)

JOINT PROTECTION MAPPINGS:
- "my [joint] hurts/aches" → add to avoidJoints (NOT for muscle soreness)
- "[joint] is bothering me", "[joint] is acting up" → add to avoidJoints
- "easy on the [joint]", "protect my [joint]" → add to avoidJoints
- IMPORTANT: "shoulders are sore" → muscleLessens NOT avoidJoints (shoulders are muscles too!)
- Only use avoidJoints for actual joint pain/injury, not muscle soreness

CONFLICT RESOLUTION RULES:
1. General Pain/Illness Override: Mentions of overall illness, general pain, or systemic issues → intensity="low"
   Examples: "I'm sick", "everything hurts", "I'm injured", "not feeling well"
   
2. Specific Joint Pain + High Intensity Request: When user mentions specific joint pain BUT explicitly requests high intensity:
   - Extract the joint → add to avoidJoints
   - Honor their intensity request → use the requested intensity
   - Examples: "knees hurt but kick my butt" → avoidJoints=["knees"], intensity="high"
   
3. Tired + Push = Moderate: "Tired but want to push" → intensity="moderate"

4. Priority Order for Intensity:
   - Explicit GENERAL intensity requests ("go hard", "take it easy") take highest priority
   - General illness/injury overrides to low
   - Specific muscle soreness or joint issues do NOT override intensity
   - "Take it easy on [specific body part]" affects only that body part, not overall intensity`;

const FEW_SHOT_EXAMPLES = [
  {
    input: "I'm feeling tired today. Let's keep it light. My quads are sore from yesterday.",
    output: {
      sessionGoal: null,
      intensity: "low",
      muscleTargets: [],
      muscleLessens: ["quads"],
      includeExercises: [],
      avoidExercises: [],
      avoidJoints: [],
      needsFollowUp: false
    }
  },
  {
    input: "Can we focus on stability today? And let's do some core work.",
    output: {
      sessionGoal: "stability",
      muscleTargets: ["core"],
      muscleLessens: [],
      includeExercises: [],
      avoidExercises: [],
      avoidJoints: [],
      needsFollowUp: false
    }
  },
  {
    input: "Skip burpees today. Also nothing hard on my wrists please.",
    output: {
      avoidExercises: ["burpees"],
      avoidJoints: ["wrists"],
      needsFollowUp: false
    }
  },
  {
    input: "I'm tired but let's push through. My shoulders are tight.",
    output: {
      sessionGoal: null,
      intensity: "moderate",
      muscleTargets: [],
      muscleLessens: ["shoulders"],
      includeExercises: [],
      avoidExercises: [],
      avoidJoints: [],
      needsFollowUp: true
    }
  },
  {
    input: "Feeling great today! Let's hit legs hard.",
    output: {
      sessionGoal: "strength",
      intensity: "high",
      muscleTargets: ["legs", "quads", "hamstrings", "glutes"],
      muscleLessens: [],
      includeExercises: [],
      avoidExercises: [],
      avoidJoints: [],
      needsFollowUp: false
    }
  },
  {
    input: "I'm feeling tired today. Don't want to do too much",
    output: {
      sessionGoal: null,
      intensity: "low",
      muscleTargets: [],
      muscleLessens: [],
      includeExercises: [],
      avoidExercises: [],
      avoidJoints: [],
      needsFollowUp: false
    }
  },
  {
    input: "My knees hurt but otherwise, kick my butt today",
    output: {
      sessionGoal: null,
      intensity: "high",
      muscleTargets: [],
      muscleLessens: [],
      includeExercises: [],
      avoidExercises: [],
      avoidJoints: ["knees"],
      needsFollowUp: false
    }
  },
  {
    input: "My shoulder is bothering me but I still want to go hard on legs",
    output: {
      sessionGoal: "strength",
      intensity: "high",
      muscleTargets: ["legs", "quads", "hamstrings", "glutes"],
      muscleLessens: [],
      includeExercises: [],
      avoidExercises: [],
      avoidJoints: ["shoulders"],
      needsFollowUp: false
    }
  },
  {
    input: "Slight soreness in my hamstrings from Tuesday, so maybe take it easy on legs?",
    output: {
      muscleLessens: ["hamstrings", "legs"],
      needsFollowUp: false
    }
  },
  {
    input: "My shoulders are sore from yesterday's workout but I want to train hard today",
    output: {
      sessionGoal: null,
      intensity: "high",
      muscleTargets: [],
      muscleLessens: ["shoulders"],
      includeExercises: [],
      avoidExercises: [],
      avoidJoints: [],
      needsFollowUp: false
    }
  },
  {
    input: "I'd like to do both deadlifts and squats today",
    output: {
      sessionGoal: null,
      muscleTargets: [],
      muscleLessens: [],
      includeExercises: ["deadlifts", "squats"],
      avoidExercises: [],
      avoidJoints: [],
      needsFollowUp: false
    }
  }
];

export async function parseWorkoutPreferences(userResponse: string): Promise<ParsedPreferences> {
  console.log("🚀 parseWorkoutPreferences called with:", userResponse);
  console.log("📋 SYSTEM_PROMPT starts with:", SYSTEM_PROMPT.substring(0, 50) + "...");
  
  let content: string | null | undefined;
  let debugInfo: any = {
    startTime: Date.now(),
    userInput: userResponse
  };
  
  try {
    const systemWithExamples = SYSTEM_PROMPT + "\n\nFEW-SHOT EXAMPLES:\n" + 
      FEW_SHOT_EXAMPLES.map(ex => 
        `Input: "${ex.input}"\nOutput: ${JSON.stringify(ex.output, null, 2)}`
      ).join("\n\n");

    // Debug log to verify we're using the new prompt
    console.log("🔍 Full prompt length:", systemWithExamples.length);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemWithExamples },
        { role: "user", content: userResponse }
      ],
      response_format: {
        type: "json_object",
      },
      temperature: 0.3,
    });

    content = completion.choices[0]?.message.content;
    debugInfo.llmResponseTime = Date.now() - debugInfo.startTime;
    debugInfo.rawLLMContent = content;
    if (!content) {
      throw new Error("No content in response");
    }

    const parsed = JSON.parse(content);
    console.log("🤖 LLM response:", JSON.stringify(parsed, null, 2));
    console.log("🔍 Specific fields - avoidJoints:", parsed.avoidJoints);
    console.log("🔍 Specific fields - intensity:", parsed.intensity);
    
    debugInfo.parsedResponse = parsed;
    debugInfo.parseSuccess = true;
    
    const validated = PreferenceSchema.parse(parsed);
    debugInfo.validationSuccess = true;
    
    const result = {
      ...validated,
      systemPromptUsed: systemWithExamples,
      rawLLMResponse: parsed, // Add the raw LLM response for debugging
      debugInfo: debugInfo
    };
    
    console.log("✅ Returning result:", result);
    return result;
  } catch (error) {
    console.error("Error parsing workout preferences:", error);
    console.error("Error details:", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined
    });
    
    // Try to get raw LLM response for debugging
    let rawResponse = null;
    try {
      if (typeof content === 'string') {
        rawResponse = JSON.parse(content);
      }
    } catch (parseErr) {
      console.error("Could not parse content for debugging:", parseErr);
    }
    
    // Return a basic response that indicates follow-up is needed
    return {
      needsFollowUp: true,
      generalNotes: userResponse,
      systemPromptUsed: SYSTEM_PROMPT + " [Error: " + (error instanceof Error ? error.message : "Unknown") + "]",
      rawLLMResponse: rawResponse,
      debugInfo: {
        ...debugInfo,
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : { message: String(error) },
        errorOccurredAt: Date.now() - debugInfo.startTime,
        rawContent: content,
        attemptedParse: rawResponse
      }
    };
  }
}