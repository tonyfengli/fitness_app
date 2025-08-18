import type { WorkoutStructure } from "../types";

export function generateStructureConstraints(
  structure?: WorkoutStructure,
): string {
  // If no structure provided, use the default 4-block structure
  if (!structure) {
    return `Exercise selection constraints:
- Block A: Select exactly 1 exercise with 3-4 sets
- IMPORTANT: Maximum 8 exercises TOTAL across ALL blocks (no more than 8)
- This means you have 7 exercises remaining to distribute across blocks B, C, and D
- Count carefully: Block A (1) + Block B + Block C + Block D must equal 8 or fewer exercises`;
  }

  // Generate constraints based on the provided structure
  const sectionConstraints = structure.sections
    .map((section) => {
      const exerciseRange =
        section.exerciseCount.min === section.exerciseCount.max
          ? `exactly ${section.exerciseCount.min} exercise${section.exerciseCount.min > 1 ? "s" : ""}`
          : `${section.exerciseCount.min}-${section.exerciseCount.max} exercises`;

      return `- ${section.name}: Select ${exerciseRange}${section.setGuidance ? ` (${section.setGuidance})` : ""}${section.description ? ` - ${section.description}` : ""}`;
    })
    .join("\n");

  const totalLimit = structure.totalExerciseLimit
    ? `\n- IMPORTANT: Maximum ${structure.totalExerciseLimit} unique exercises TOTAL across ALL sections`
    : "";

  return `Exercise selection constraints:
${sectionConstraints}${totalLimit}`;
}

export function generateOutputFormat(structure?: WorkoutStructure): string {
  if (!structure) {
    // Default format for backward compatibility
    return `Return a JSON object with this structure:
{
  "blockA": [{"exercise": "exercise name", "sets": number}],
  "blockB": [{"exercise": "exercise name", "sets": number}],
  "blockC": [{"exercise": "exercise name", "sets": number}],
  "blockD": [{"exercise": "exercise name", "sets": number}],
  "reasoning": "Your explanation for why you selected each exercise AND state the total set range provided"
}`;
  }

  // Generate format based on structure
  const sectionFormats = structure.sections
    .map((section) => {
      const key = section.name.toLowerCase().replace(/\s+/g, "");
      return `  "${key}": [{"exercise": "exercise name", "sets": number}]`;
    })
    .join(",\n");

  return `Return a JSON object with this structure:
{
${sectionFormats},
  "reasoning": "Your explanation for why you selected each exercise AND state the total set range provided"
}`;
}
