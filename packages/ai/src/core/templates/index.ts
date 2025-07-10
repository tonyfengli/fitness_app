import { WorkoutTemplateHandler } from "./WorkoutTemplateHandler";
import type { TemplateHandler } from "./types";

export * from "./types";
export { WorkoutTemplateHandler };

/**
 * Factory function to get the appropriate template handler
 * @param templateId - The ID of the template to use
 * @returns TemplateHandler instance
 */
export function getTemplateHandler(templateId: string): TemplateHandler {
  console.log(`🏭 Getting template handler for: ${templateId}`);
  
  switch (templateId) {
    case 'workout':
    case 'default':
      return new WorkoutTemplateHandler(false);
    
    case 'full_body':
    case 'fullbody':
      // Now both use the same handler with isFullBody=true
      return new WorkoutTemplateHandler(true);
    
    // Future template handlers can be added here
    // case 'strength_focus':
    //   return new StrengthFocusTemplateHandler();
    // case 'hypertrophy':
    //   return new HypertrophyTemplateHandler();
    
    default:
      console.log(`⚠️  Unknown template ID: ${templateId}, falling back to workout template`);
      return new WorkoutTemplateHandler(false);
  }
}