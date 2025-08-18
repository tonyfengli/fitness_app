import type { PromptConfig } from "./types";
import {
  CONSTRAINTS_SECTION,
  CONTEXT_SECTION,
  EXAMPLES_SECTION,
  INSTRUCTIONS_SECTION,
  OUTPUT_FORMAT_SECTION,
  ROLE_SECTION,
  RULES_SECTION,
} from "./sections";
import {
  generateOutputFormat,
  generateStructureConstraints,
} from "./sections/dynamicStructure";
import { generateBMFGroupPrompt } from "./sections/group/bmfPrompt";

export class WorkoutPromptBuilder {
  protected config: PromptConfig;

  constructor(config: PromptConfig = {}) {
    this.config = config;
  }

  build(): string {
    // Handle group workouts
    if (this.config.workoutType === "group") {
      return this.buildGroupPrompt();
    }

    // Existing individual workout logic
    const sections: string[] = [];

    // Add role section
    sections.push(this.config.customSections?.role ?? ROLE_SECTION);

    // Add rules section with potential modifications
    let rulesSection = this.config.customSections?.rules ?? RULES_SECTION;
    if (this.config.emphasizeRequestedExercises) {
      rulesSection = rulesSection.replace(
        "Includes any requested exercises, force it in",
        "CRITICAL: Must include any requested exercises - these are non-negotiable requirements",
      );
    }
    sections.push(rulesSection);

    // Add context section
    sections.push(this.config.customSections?.context ?? CONTEXT_SECTION);

    // Add constraints section - use dynamic structure if provided
    if (this.config.workoutStructure) {
      // Generate constraints from the workout structure
      const baseConstraints = CONSTRAINTS_SECTION.split("\n\n")[0]; // Keep the set distribution part
      const structureConstraints = generateStructureConstraints(
        this.config.workoutStructure,
      );
      sections.push(`${baseConstraints}\n\n${structureConstraints}`);
    } else {
      // Use default constraints with potential modifications
      let constraintsSection =
        this.config.customSections?.constraints ?? CONSTRAINTS_SECTION;
      if (this.config.strictExerciseLimit) {
        constraintsSection = constraintsSection.replace(
          "IMPORTANT: Maximum 8 exercises TOTAL across ALL blocks (no more than 8)",
          "CRITICAL REQUIREMENT: You MUST use EXACTLY 8 exercises TOTAL across ALL blocks (not fewer, not more)",
        );
      }
      sections.push(constraintsSection);
    }

    // Add output format section - use dynamic format if structure provided
    if (this.config.workoutStructure) {
      sections.push(generateOutputFormat(this.config.workoutStructure));
    } else {
      sections.push(
        this.config.customSections?.outputFormat ?? OUTPUT_FORMAT_SECTION,
      );
    }

    // Add examples section if configured
    if (this.config.includeExamples) {
      sections.push(this.config.customSections?.examples ?? EXAMPLES_SECTION);
    }

    // Add instructions section
    sections.push(
      this.config.customSections?.instructions ?? INSTRUCTIONS_SECTION,
    );

    return sections.join("\n\n");
  }

  // Static method for backward compatibility
  static buildDefault(): string {
    return new WorkoutPromptBuilder().build();
  }

  // Build group workout prompt
  private buildGroupPrompt(): string {
    if (!this.config.groupConfig) {
      throw new Error("Group workout requires groupConfig");
    }

    // For now, only support BMF template
    // In the future, we can add more template strategies here
    const templateType =
      this.config.groupConfig.templateType || "full_body_bmf";

    switch (templateType) {
      case "full_body_bmf":
        return generateBMFGroupPrompt(this.config.groupConfig);
      default:
        throw new Error(`Unsupported group template type: ${templateType}`);
    }
  }
}
