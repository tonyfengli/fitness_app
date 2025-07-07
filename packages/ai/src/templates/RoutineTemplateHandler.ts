import type { ScoredExercise } from "../types/scoredExercise";
import type { TemplateHandler, OrganizedExercises } from "./types";

export class RoutineTemplateHandler implements TemplateHandler {
  organize(exercises: ScoredExercise[]): OrganizedExercises {
    console.log('🏗️ RoutineTemplateHandler organizing exercises into blocks');
    
    return {
      blockA: this.getExercisesByTag(exercises, 'primary_strength'),
      blockB: this.getExercisesByTag(exercises, 'secondary_strength'),
      blockC: this.getExercisesByTag(exercises, 'accessory'),
      blockD: this.getExercisesByTag(exercises, 'core'),
      blockE: this.getExercisesByTag(exercises, 'capacity'),
    };
  }
  
  private getExercisesByTag(exercises: ScoredExercise[], functionTag: string): ScoredExercise[] {
    // Filter exercises that have the specified function tag
    const filtered = exercises.filter(exercise => 
      exercise.functionTags && exercise.functionTags.includes(functionTag)
    );
    
    // Sort by score (highest first)
    return filtered.sort((a, b) => b.score - a.score);
  }
}