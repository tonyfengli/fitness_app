import { RoutineTemplateHandler } from "./RoutineTemplateHandler";
import type { TemplateHandler } from "./types";

export * from "./types";
export { RoutineTemplateHandler };

/**
 * Factory function to get the appropriate template handler
 * @param templateId - The ID of the template to use
 * @returns TemplateHandler instance
 */
export function getTemplateHandler(templateId: string): TemplateHandler {
  console.log(`🏭 Getting template handler for: ${templateId}`);
  
  switch (templateId) {
    case 'routine':
    case 'default':
      return new RoutineTemplateHandler();
    
    case 'full_body':
    case 'fullbody':
      // Import directly to avoid caching issues
      const { FullBodyRoutineTemplateHandler } = require('./FullBodyRoutineTemplateHandler');
      return new FullBodyRoutineTemplateHandler();
    
    // Future template handlers can be added here
    // case 'strength_focus':
    //   return new StrengthFocusTemplateHandler();
    // case 'hypertrophy':
    //   return new HypertrophyTemplateHandler();
    
    default:
      console.log(`⚠️  Unknown template ID: ${templateId}, falling back to routine template`);
      return new RoutineTemplateHandler();
  }
}