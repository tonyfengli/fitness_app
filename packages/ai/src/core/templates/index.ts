import { WorkoutTemplateHandler } from "./WorkoutTemplateHandler";
import type { TemplateHandler } from "./types";
import type { TemplateSelectionCriteria } from "./config/templateSelector";

export * from "./types";
export { WorkoutTemplateHandler };

/**
 * Factory function to get the appropriate template handler
 * @param templateId - The ID of the template to use
 * @param criteria - Optional template selection criteria
 * @returns TemplateHandler instance
 */
export function getTemplateHandler(
  templateId: string, 
  criteria?: { workoutType?: string; sessionGoal?: string; }
): TemplateHandler {
  console.log(`🏭 Getting template handler for: ${templateId}`);
  
  switch (templateId) {
    case 'workout':
    case 'default':
      return new WorkoutTemplateHandler(false);
    
    case 'full_body':
    case 'fullbody':
      // Now both use the same handler with isFullBody=true
      return new WorkoutTemplateHandler(true);
    
    case 'circuit_training':
    case 'circuit':
      // Circuit training template
      return new WorkoutTemplateHandler(false, { 
        workoutType: 'circuit',
        templateId: 'circuit_training' 
      });
    
    case 'dynamic':
      // Use criteria to select template dynamically
      return new WorkoutTemplateHandler(false, criteria as TemplateSelectionCriteria);
    
    default:
      console.log(`⚠️  Unknown template ID: ${templateId}, falling back to workout template`);
      return new WorkoutTemplateHandler(false);
  }
}