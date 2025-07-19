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
};

const SYSTEM_PROMPT = `You are an AI assistant helping a fitness trainer prepare workouts for clients. After a client checks in, they send a short message about how they're feeling and any preferences for their workout.

Your job is to carefully extract structured data from their message and return it as JSON. You must use both explicit statements (e.g., "I want a light workout") and implicit cues (e.g., "I'm tired" → intensity=low).

If the client's message is vague, ambiguous, or provides mixed/conflicting signals, set needsFollowUp=true. Otherwise, keep needsFollowUp=false.

Return your response as a JSON object with the extracted preferences.

EXTRACTION FIELDS:
1. session_goal → Client's goal for the session
   - Valid options: "strength", "stability", null
   
2. intensity → Overall intensity level  
   - Valid options: "low", "moderate", "high"
   - IMPORTANT: Default to "moderate" if no intensity indicators are present
   
3. muscle_targets → Muscle groups the client wants to target
   - Valid options: chest, back, shoulders, arms, legs, glutes, core, triceps, biceps, quads, hamstrings, calves
   
4. muscle_lessens → Muscle groups that are sore or fatigued
   - Valid options: Same as muscle_targets
   
5. include_exercises → Specific exercises the client requests to include
   - Must be specific exercise names (e.g., "squats", "bench press", "deadlifts")
   
6. avoid_exercises → Specific exercises the client requests to avoid
   - Must be specific exercise names
   
7. avoid_joints → Joints the client wants to protect or avoid stressing
   - Common joints: knees, wrists, shoulders, elbows, ankles, hips, lower back
   
8. needsFollowUp → true if vague/ambiguous; false if useful preferences extracted

DETAILED IMPLICIT MAPPING RULES:

SESSION GOAL MAPPINGS:
Strength Indicators:
- "build strength", "get stronger", "strength work" → session_goal="strength"
- "heavy", "heavy weights", "lift heavy", "go heavy" → session_goal="strength"
- "PR", "personal record", "max out", "test max" → session_goal="strength"
- "power", "explosive", "powerful" → session_goal="strength"
- "compound movements", "big lifts" → session_goal="strength"

Stability Indicators:
- "balance", "stability", "stabilization" → session_goal="stability"
- "joint stability" → session_goal="stability"
- "control", "controlled movements", "slow and controlled" → session_goal="stability"
- "rehab", "prehab", "recovery work" → session_goal="stability"
- "activation", "activate muscles" → session_goal="stability"

Default: If no clear goal indicators → session_goal=null

INTENSITY MAPPINGS:
Low Intensity Indicators:
- "tired", "exhausted", "wiped out", "drained", "beat", "worn out" → intensity="low"
- "sore all over", "everything hurts", "rough night" → intensity="low"
- "take it easy", "go easy", "light day", "easy session" → intensity="low"
- "not feeling it", "low energy", "dragging" → intensity="low"
- Any mention of pain, injury, or illness → intensity="low"

Moderate Intensity Indicators:
- "normal", "regular", "standard", "typical" → intensity="moderate"
- "decent", "okay", "alright", "fine" → intensity="moderate"
- Mixed signals (tired + push through) → intensity="moderate"
- NO intensity indicators mentioned → intensity="moderate" (DEFAULT)

High Intensity Indicators:
- "feeling great", "energized", "pumped", "ready to go" → intensity="high"
- "crush it", "push hard", "go heavy", "max out" → intensity="high"
- "feeling strong", "well-rested", "fired up" → intensity="high"
- "bring it on", "let's do this", "all in" → intensity="high"

MUSCLE GROUP MAPPINGS:
Target Indicators:
- "hit [muscle]", "work on [muscle]", "focus on [muscle]" → add to muscle_targets
- "[muscle] day", "train [muscle]", "blast [muscle]" → add to muscle_targets
Common aliases:
- "upper body" → [chest, back, shoulders, arms]
- "lower body" → [legs, glutes]
- "arms" → [biceps, triceps]
- "legs" → [quads, hamstrings, calves]

Avoidance Indicators:
- "[muscle] is sore/tight/tired" → add to muscle_lessens
- "skip [muscle]", "avoid [muscle]", "no [muscle]" → add to muscle_lessens
- "[muscle] needs rest", "[muscle] is fried" → add to muscle_lessens

JOINT PROTECTION MAPPINGS:
- "my [joint] hurts/aches/is sore" → add to avoid_joints
- "[joint] is bothering me", "[joint] is acting up" → add to avoid_joints
- "easy on the [joint]", "protect my [joint]" → add to avoid_joints

CONFLICT RESOLUTION RULES:
1. Pain/Injury Override: Any mention of pain or injury automatically sets intensity="low"
2. Tired + Push = Moderate: "Tired but want to push" → intensity="moderate"`;

const FEW_SHOT_EXAMPLES = [
  {
    input: "I'm feeling tired today. Let's keep it light. My quads are sore from yesterday.",
    output: {
      session_goal: null,
      intensity: "low",
      muscle_targets: [],
      muscle_lessens: ["quads"],
      include_exercises: [],
      avoid_exercises: [],
      avoid_joints: [],
      needsFollowUp: false
    }
  },
  {
    input: "Can we focus on stability today? And let's do some core work.",
    output: {
      session_goal: "stability",
      intensity: "moderate",
      muscle_targets: ["core"],
      muscle_lessens: [],
      include_exercises: [],
      avoid_exercises: [],
      avoid_joints: [],
      needsFollowUp: false
    }
  },
  {
    input: "Skip burpees today. Also nothing hard on my wrists please.",
    output: {
      session_goal: null,
      intensity: "moderate",
      muscle_targets: [],
      muscle_lessens: [],
      include_exercises: [],
      avoid_exercises: ["burpees"],
      avoid_joints: ["wrists"],
      needsFollowUp: false
    }
  },
  {
    input: "I'm tired but let's push through. My shoulders are tight.",
    output: {
      session_goal: null,
      intensity: "moderate",
      muscle_targets: [],
      muscle_lessens: ["shoulders"],
      include_exercises: [],
      avoid_exercises: [],
      avoid_joints: [],
      needsFollowUp: true
    }
  },
  {
    input: "Feeling great today! Let's hit legs hard.",
    output: {
      session_goal: "strength",
      intensity: "high",
      muscle_targets: ["legs", "quads", "hamstrings", "glutes"],
      muscle_lessens: [],
      include_exercises: [],
      avoid_exercises: [],
      avoid_joints: [],
      needsFollowUp: false
    }
  },
  {
    input: "I'm feeling tired today. Don't want to do too much",
    output: {
      session_goal: null,
      intensity: "low",
      muscle_targets: [],
      muscle_lessens: [],
      include_exercises: [],
      avoid_exercises: [],
      avoid_joints: [],
      needsFollowUp: false
    }
  }
];

export async function parseWorkoutPreferences(userResponse: string): Promise<ParsedPreferences> {
  console.log("🚀 parseWorkoutPreferences called with:", userResponse);
  console.log("📋 SYSTEM_PROMPT starts with:", SYSTEM_PROMPT.substring(0, 50) + "...");
  
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

    const content = completion.choices[0]?.message.content;
    if (!content) {
      throw new Error("No content in response");
    }

    const parsed = JSON.parse(content);
    console.log("🤖 LLM response:", parsed);
    
    const validated = PreferenceSchema.parse(parsed);
    
    const result = {
      ...validated,
      systemPromptUsed: SYSTEM_PROMPT
    };
    
    console.log("✅ Returning result:", result);
    return result;
  } catch (error) {
    console.error("Error parsing workout preferences:", error);
    // Return a basic response that indicates follow-up is needed
    return {
      needsFollowUp: true,
      generalNotes: userResponse
    };
  }
}