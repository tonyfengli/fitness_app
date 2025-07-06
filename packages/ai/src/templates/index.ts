import { MVPTemplateHandler } from "./MVPTemplateHandler";
import type { TemplateHandler } from "./types";

export * from "./types";
export { MVPTemplateHandler };

/**
 * Factory function to get the appropriate template handler
 * @param templateId - The ID of the template to use
 * @returns TemplateHandler instance
 */
export function getTemplateHandler(templateId: string): TemplateHandler {
  console.log(`🏭 Getting template handler for: ${templateId}`);
  
  switch (templateId) {
    case 'mvp':
    case 'default':
      return new MVPTemplateHandler();
    
    // Future template handlers can be added here
    // case 'strength_focus':
    //   return new StrengthFocusTemplateHandler();
    // case 'hypertrophy':
    //   return new HypertrophyTemplateHandler();
    
    default:
      console.log(`⚠️  Unknown template ID: ${templateId}, falling back to MVP template`);
      return new MVPTemplateHandler();
  }
}