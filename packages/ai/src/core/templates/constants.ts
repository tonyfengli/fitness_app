export const TEMPLATE_TYPES = {
  BMF: 'full_body_bmf',
  STANDARD: 'standard',
  CIRCUIT: 'circuit'
} as const;

export type TemplateType = typeof TEMPLATE_TYPES[keyof typeof TEMPLATE_TYPES];

// Map session template types to exercise template types
export function mapTemplateTypeToExerciseFilter(sessionTemplate: string): string {
  switch(sessionTemplate) {
    case 'full_body_bmf': 
      return 'bmf';
    case 'standard': 
      return 'standard';
    case 'circuit': 
      return 'circuit';
    default: 
      return 'standard';
  }
}

// Validate template type
export function isValidTemplateType(template: string): template is TemplateType {
  return Object.values(TEMPLATE_TYPES).includes(template as TemplateType);
}