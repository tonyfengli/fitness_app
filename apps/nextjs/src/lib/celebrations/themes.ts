/**
 * Celebration themes: the prompt for the AI background and the words on the card.
 * One background per theme is generated and cached; the member's photo and name are
 * composited in code (compose.ts), so the model never sees a member.
 */

export type CelebrationType = "birthday" | "milestone";

export interface Theme {
  key: string;
  type: CelebrationType;
  /** Prompt for the background only: no people, no text, room in the middle for a photo */
  backgroundPrompt: string;
  headline: (firstName: string) => string;
  subline?: (detail?: string) => string | undefined;
}

const NO_TEXT_NO_PEOPLE =
  "No people, no faces, no text, no letters, no logos. Leave the center of the image calm and uncluttered " +
  "so a circular portrait can sit there, with the busiest details toward the edges.";

export const THEMES: Record<string, Theme> = {
  "birthday-confetti": {
    key: "birthday-confetti",
    type: "birthday",
    backgroundPrompt:
      "A vibrant, celebratory birthday background for a strength-training gym: dark charcoal backdrop with " +
      "bursts of gold and electric-blue confetti, soft bokeh lights, a few subtle kettlebell and barbell " +
      "silhouettes in the corners, premium and energetic, square composition. " + NO_TEXT_NO_PEOPLE,
    headline: (first) => `Happy Birthday, ${first}!`,
    subline: () => "From all of us at Elev8",
  },
  "milestone-classes": {
    key: "milestone-classes",
    type: "milestone",
    backgroundPrompt:
      "A bold achievement background for a gym: deep navy with radiating gold light rays from the center, " +
      "subtle laurel shapes near the bottom, faint chalk-dust texture, strong and triumphant, square composition. " +
      NO_TEXT_NO_PEOPLE,
    headline: (first) => `${first} did it!`,
    subline: (detail) => (detail ? `${detail} classes at Elev8` : undefined),
  },
};

export const DEFAULT_THEME: Record<CelebrationType, string> = {
  birthday: "birthday-confetti",
  milestone: "milestone-classes",
};
