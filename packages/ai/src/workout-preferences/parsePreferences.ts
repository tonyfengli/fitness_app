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
  sessionGoal: z.enum(["strength", "stability", "conditioning", "general"]).optional(),
  generalNotes: z.string().optional(),
  needsFollowUp: z.boolean().describe("Whether the response needs clarification or follow-up questions"),
});

export type ParsedPreferences = z.infer<typeof PreferenceSchema>;

const SYSTEM_PROMPT = `You are a fitness preference parser. Extract workout preferences from user responses.

Guidelines:
- Intensity: Map energy levels to low/moderate/high
  - "tired", "exhausted", "sore" → low
  - "normal", "ok", "fine" → moderate  
  - "energetic", "great", "pumped" → high
- Muscle targets: Extract any muscles they want to work
- Muscle avoidance: Extract any muscles to avoid or that are sore
- Joint issues: Extract any joint pain or limitations
- Session goals: Determine if they want strength, stability, conditioning, or general training
- Include/exclude exercises: Extract any specific exercise requests
- Set needsFollowUp to true if the response is vague or needs clarification

Normalize muscle names to: chest, back, shoulders, arms, legs, glutes, core, triceps, biceps, quads, hamstrings, calves
Normalize joints to: shoulder, knee, hip, ankle, wrist, elbow, neck, back`;

export async function parseWorkoutPreferences(userResponse: string): Promise<ParsedPreferences> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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
    const validated = PreferenceSchema.parse(parsed);
    
    return validated;
  } catch (error) {
    console.error("Error parsing workout preferences:", error);
    // Return a basic response that indicates follow-up is needed
    return {
      needsFollowUp: true,
      generalNotes: userResponse
    };
  }
}