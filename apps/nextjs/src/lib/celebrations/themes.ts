/**
 * Celebration themes ("designs"): the prompt for the AI background, the accent color and the
 * words on the card. One background per theme is generated and cached; the member's photo and
 * name are composited in code (compose.ts), so the model never sees a member.
 *
 * Adding a design = adding an entry to THEMES. New cards then take designs in rotation
 * (nextTheme), one per member; a founder can ask the Chief of Staff for a different one.
 */

export type CelebrationType = "birthday" | "milestone";

export interface Theme {
  key: string;
  type: CelebrationType;
  /** Prompt for the background only: no people, no text, room in the middle for a photo */
  backgroundPrompt: string;
  /** Ring around the photo, the second line, the rule in the no-photo layout */
  accent: string;
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
    accent: "#f5c542",
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
    accent: "#f5c542",
    headline: (first) => `${first} did it!`,
    subline: (detail) => (detail ? `${detail} classes at Elev8` : undefined),
  },
};

/** The designs for one kind of card, in the order they rotate */
export const themesFor = (type: CelebrationType): Theme[] => Object.values(THEMES).filter((t) => t.type === type);

/**
 * The design the next new card gets: the one used longest ago (never used first, in list
 * order). `recentKeys` are the theme keys of earlier cards of this type, newest first.
 * With one design per type this is always that design.
 */
export function nextTheme(type: CelebrationType, recentKeys: string[]): Theme {
  const options = themesFor(type);
  const first = options[0];
  if (!first) throw new Error(`no ${type} design in THEMES`);
  const lastUsed = (key: string) => {
    const i = recentKeys.indexOf(key);
    return i === -1 ? Infinity : i; // further back (or never) = larger
  };
  return options.reduce((best, t) => (lastUsed(t.key) > lastUsed(best.key) ? t : best), first);
}

/** The design after `currentKey` in its type's list (wraps); for "give this card another design" */
export function themeAfter(currentKey: string): Theme | null {
  const current = THEMES[currentKey];
  if (!current) return null;
  const options = themesFor(current.type);
  if (options.length < 2) return null;
  return options[(options.findIndex((t) => t.key === currentKey) + 1) % options.length] ?? null;
}
