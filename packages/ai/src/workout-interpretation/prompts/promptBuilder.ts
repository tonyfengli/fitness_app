import {
  ROLE_SECTION,
  RULES_SECTION,
  CONTEXT_SECTION,
  CONSTRAINTS_SECTION,
  OUTPUT_FORMAT_SECTION,
  EXAMPLES_SECTION,
  INSTRUCTIONS_SECTION
} from './sections';
import type { PromptConfig } from './types';

export class WorkoutPromptBuilder {
  private config: PromptConfig;
  
  constructor(config: PromptConfig = {}) {
    this.config = config;
  }
  
  build(): string {
    const sections: string[] = [];
    
    // Add role section
    sections.push(this.config.customSections?.role ?? ROLE_SECTION);
    
    // Add rules section with potential modifications
    let rulesSection = this.config.customSections?.rules ?? RULES_SECTION;
    if (this.config.emphasizeRequestedExercises) {
      rulesSection = rulesSection.replace(
        'Includes any requested exercises, force it in',
        'CRITICAL: Must include any requested exercises - these are non-negotiable requirements'
      );
    }
    sections.push(rulesSection);
    
    // Add context section
    sections.push(this.config.customSections?.context ?? CONTEXT_SECTION);
    
    // Add constraints section with potential modifications
    let constraintsSection = this.config.customSections?.constraints ?? CONSTRAINTS_SECTION;
    if (this.config.strictExerciseLimit) {
      constraintsSection = constraintsSection.replace(
        'IMPORTANT: Maximum 8 exercises TOTAL across ALL blocks (no more than 8)',
        'CRITICAL REQUIREMENT: You MUST use EXACTLY 8 exercises TOTAL across ALL blocks (not fewer, not more)'
      );
    }
    sections.push(constraintsSection);
    
    // Add output format section
    sections.push(this.config.customSections?.outputFormat ?? OUTPUT_FORMAT_SECTION);
    
    // Add examples section if configured
    if (this.config.includeExamples) {
      sections.push(this.config.customSections?.examples ?? EXAMPLES_SECTION);
    }
    
    // Add instructions section
    sections.push(this.config.customSections?.instructions ?? INSTRUCTIONS_SECTION);
    
    return sections.join('\n\n');
  }
  
  // Static method for backward compatibility
  static buildDefault(): string {
    return new WorkoutPromptBuilder().build();
  }
}