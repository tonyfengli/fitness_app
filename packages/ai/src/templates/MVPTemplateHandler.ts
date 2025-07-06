import type { ScoredExercise } from "../types/scoredExercise";
import type { TemplateHandler, OrganizedExercises } from "./types";

export class MVPTemplateHandler implements TemplateHandler {
  organize(exercises: ScoredExercise[]): OrganizedExercises {
    console.log('🏗️ MVPTemplateHandler organizing exercises into blocks');
    
    return {
      blockA: this.getTopExercises(exercises, 'primary_strength'),
      blockB: this.getTopExercises(exercises, 'secondary_strength'),
      blockC: this.getTopExercises(exercises, 'accessory'),
      blockD: this.getTopExercises(exercises, 'core'),
      blockE: this.getTopExercises(exercises, 'capacity'),
    };
  }
  
  private getTopExercises(exercises: ScoredExercise[], functionTag: string): ScoredExercise[] {
    console.log(`🎯 Getting top exercises for function tag: ${functionTag}`);
    
    // Filter exercises that have the specified function tag
    const filteredByFunctionTag = exercises.filter(exercise => 
      exercise.functionTags && exercise.functionTags.includes(functionTag)
    );
    
    console.log(`📊 Found ${filteredByFunctionTag.length} exercises with function tag: ${functionTag}`);
    
    // Sort by score (highest first) and take top 5
    // TODO: Define what "top" means - for now using highest score
    const topExercises = filteredByFunctionTag
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    
    console.log(`✅ Selected top ${topExercises.length} exercises for ${functionTag}`);
    
    return topExercises;
  }
}