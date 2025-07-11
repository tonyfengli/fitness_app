import type { WorkoutTemplate, FilterWorkoutTemplate } from "../types";
import { hasFullBodyFlag } from "../types/filterTypes";
import type { ScoredExercise } from "../types/scoredExercise";
import { getTemplateHandler } from "../core/templates";
import type { OrganizedExercises } from "../core/templates/types";

export interface TemplateOrganizationResult {
  organizedExercises: OrganizedExercises;
  templateId: string;
  isFullBody: boolean;
}

/**
 * Apply template organization to filtered exercises
 * Extracted from filterExercisesFromInput for better separation of concerns
 */
export function applyTemplateOrganization(
  exercises: ScoredExercise[],
  workoutTemplate: WorkoutTemplate | FilterWorkoutTemplate | undefined
): TemplateOrganizationResult | null {
  if (!workoutTemplate) {
    return null;
  }

  const isFullBody = hasFullBodyFlag(workoutTemplate) ? workoutTemplate.isFullBody ?? false : false;
  const templateId = isFullBody ? 'full_body' : 'workout';
  
  console.log(`🏋️ Using ${isFullBody ? 'FullBodyWorkoutTemplateHandler' : 'WorkoutTemplateHandler'} to select exercises with constraints`);
  console.log(`📊 Total exercises: ${exercises.length}`);
  
  const templateHandler = getTemplateHandler(templateId);
  const organized = templateHandler.organize(exercises);
  
  console.log(`📊 Exercise selections:`);
  console.log(`   - Block A (primary_strength): ${organized.blockA.length} exercises selected`);
  console.log(`   - Block B (secondary_strength): ${organized.blockB.length} exercises selected`);
  console.log(`   - Block C (accessory): ${organized.blockC.length} exercises selected`);
  console.log(`   - Block D (core & capacity): ${organized.blockD.length} exercises selected`);
  
  return {
    organizedExercises: organized,
    templateId,
    isFullBody
  };
}