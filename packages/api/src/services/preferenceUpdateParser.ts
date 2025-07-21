import { createLogger } from "../utils/logger";
import { exerciseUpdateParser } from "./exerciseUpdateParser";
import type { ParsedPreferences } from "@acme/ai";

const logger = createLogger("PreferenceUpdateParser");

export interface UpdateParseResult {
  hasUpdates: boolean;
  updates: Partial<ParsedPreferences>;
  updateType: 'add' | 'remove' | 'change' | 'mixed' | null;
  fieldsUpdated: string[];
  rawInput: string;
}

export class PreferenceUpdateParser {
  /**
   * Patterns for detecting update intent
   */
  private static readonly UPDATE_PATTERNS = {
    // Addition patterns
    add: /\b(add|include|also|plus|and|with)\b/i,
    
    // Removal patterns  
    remove: /\b(remove|skip|no|avoid|without|stop|don't|dont|exclude)\b/i,
    
    // Change patterns
    change: /\b(change|switch|instead|replace|make it|update)\b/i,
    
    // Intensity changes
    intensityChange: /\b(go|make it|switch to|change to)\s+(easy|easier|light|lighter|hard|harder|moderate|medium)\b/i,
    
    // Session goal changes
    goalChange: /\b(focus on|switch to|change to|do)\s+(strength|stability|endurance)\b/i,
  };

  /**
   * Parse a message for preference updates
   */
  static async parseUpdate(
    message: string, 
    currentPreferences: ParsedPreferences,
    businessId?: string
  ): Promise<UpdateParseResult> {
    const result: UpdateParseResult = {
      hasUpdates: false,
      updates: {},
      updateType: null,
      fieldsUpdated: [],
      rawInput: message
    };

    const lowerMessage = message.toLowerCase();

    // Check for intensity updates
    const intensityUpdate = this.parseIntensityUpdate(lowerMessage);
    if (intensityUpdate) {
      result.updates.intensity = intensityUpdate;
      result.fieldsUpdated.push('intensity');
      result.hasUpdates = true;
    }

    // Check for session goal updates
    const goalUpdate = this.parseSessionGoalUpdate(lowerMessage);
    if (goalUpdate !== undefined) {
      result.updates.sessionGoal = goalUpdate;
      result.fieldsUpdated.push('sessionGoal');
      result.hasUpdates = true;
    }

    // Check for exercise additions/removals using the exercise update parser
    const exerciseUpdateIntent = await exerciseUpdateParser.parseExerciseUpdate(message, businessId);
    
    if (exerciseUpdateIntent.action !== 'unknown' && exerciseUpdateIntent.exercises.length > 0) {
      if (exerciseUpdateIntent.action === 'add') {
        // For additions, append to include list (avoiding duplicates)
        const currentIncludes = currentPreferences.includeExercises || [];
        const newExercises = exerciseUpdateIntent.exercises.filter(
          exercise => !currentIncludes.some(
            included => included.toLowerCase() === exercise.toLowerCase()
          )
        );
        
        if (newExercises.length > 0) {
          result.updates.includeExercises = [...currentIncludes, ...newExercises];
          result.fieldsUpdated.push('includeExercises');
          result.hasUpdates = true;
        }
      } else if (exerciseUpdateIntent.action === 'remove') {
        // For removals, we have two options:
        // 1. If the exercise is in includeExercises, remove it
        // 2. Otherwise, add it to avoidExercises
        
        const currentIncludes = currentPreferences.includeExercises || [];
        const exercisesToRemove = exerciseUpdateIntent.exercises;
        
        // Filter out from includes
        const filteredIncludes = currentIncludes.filter(
          exercise => !exercisesToRemove.some(
            toRemove => exercise.toLowerCase() === toRemove.toLowerCase()
          )
        );
        
        // Check if we actually removed anything from includes
        const removedFromIncludes = currentIncludes.length > filteredIncludes.length;
        
        if (removedFromIncludes) {
          // Some exercises were removed from includes
          result.updates.includeExercises = filteredIncludes;
          result.fieldsUpdated.push('includeExercises');
          result.hasUpdates = true;
        }
        
        // Always add removed exercises to avoid list
        const currentAvoids = currentPreferences.avoidExercises || [];
        const newAvoids = exercisesToRemove.filter(
          exercise => !currentAvoids.some(
            avoided => avoided.toLowerCase() === exercise.toLowerCase()
          )
        );
        
        if (newAvoids.length > 0) {
          result.updates.avoidExercises = [...currentAvoids, ...newAvoids];
          result.fieldsUpdated.push('avoidExercises');
          result.hasUpdates = true;
        }
      }
    }

    // Check for muscle target updates
    const muscleUpdates = this.parseMuscleUpdates(lowerMessage, currentPreferences);
    if (muscleUpdates.hasChanges) {
      if (muscleUpdates.targetsToAdd.length > 0) {
        result.updates.muscleTargets = [
          ...(currentPreferences.muscleTargets || []),
          ...muscleUpdates.targetsToAdd
        ];
        result.fieldsUpdated.push('muscleTargets');
      }
      if (muscleUpdates.toAvoid.length > 0) {
        result.updates.muscleLessens = [
          ...(currentPreferences.muscleLessens || []),
          ...muscleUpdates.toAvoid
        ];
        result.fieldsUpdated.push('muscleLessens');
      }
      result.hasUpdates = true;
    }

    // Check for joint updates
    const jointUpdates = this.parseJointUpdates(lowerMessage, currentPreferences);
    if (jointUpdates.length > 0) {
      result.updates.avoidJoints = jointUpdates;
      result.fieldsUpdated.push('avoidJoints');
      result.hasUpdates = true;
    }

    // Determine update type
    if (result.hasUpdates) {
      result.updateType = this.determineUpdateType(lowerMessage);
    }

    logger.info("Parsed preference update", {
      hasUpdates: result.hasUpdates,
      fieldsUpdated: result.fieldsUpdated,
      updateType: result.updateType
    });

    return result;
  }

  /**
   * Parse intensity updates
   */
  private static parseIntensityUpdate(message: string): ParsedPreferences['intensity'] | null {
    const patterns = [
      { pattern: /\b(easy|easier|light|lighter|low|gentle|relax|tired)\b/i, value: 'low' as const },
      { pattern: /\b(moderate|medium|normal|regular)\b/i, value: 'moderate' as const },
      { pattern: /\b(hard|harder|heavy|intense|high|crush|destroy|kick\s+(my\s+)?(butt|ass)|push\s+me|challenge\s+me|bring\s+it|all\s+out)\b/i, value: 'high' as const },
    ];

    // Look for explicit intensity change patterns
    if (this.UPDATE_PATTERNS.intensityChange.test(message)) {
      for (const { pattern, value } of patterns) {
        if (pattern.test(message)) {
          return value;
        }
      }
    }

    // Also check for simple intensity mentions with update context
    const hasUpdateContext = /\b(actually|instead|change|make|go|feel|feeling|want|push|challenge|bring|destroy|crush|let's|need|take)\b/i.test(message);
    if (hasUpdateContext) {
      for (const { pattern, value } of patterns) {
        if (pattern.test(message)) {
          return value;
        }
      }
    }

    return null;
  }

  /**
   * Parse session goal updates
   */
  private static parseSessionGoalUpdate(message: string): ParsedPreferences['sessionGoal'] | undefined {
    if (/\b(strength|strong|heavy)\b/i.test(message) && this.hasUpdateIntent(message)) {
      return 'strength';
    }
    if (/\b(stability|balance|control)\b/i.test(message) && this.hasUpdateIntent(message)) {
      return 'stability';
    }
    return undefined;
  }


  /**
   * Parse muscle updates
   */
  private static parseMuscleUpdates(
    message: string,
    current: ParsedPreferences
  ): { hasChanges: boolean; targetsToAdd: string[]; toAvoid: string[] } {
    const result = { hasChanges: false, targetsToAdd: [] as string[], toAvoid: [] as string[] };
    
    const musclePatterns = [
      'chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 
      'core', 'abs', 'triceps', 'biceps', 'quads', 'hamstrings', 
      'calves', 'delts', 'lats', 'traps'
    ];
    
    const muscleRegex = new RegExp(`\\b(${musclePatterns.join('|')})\\b`, 'gi');
    const matches = message.match(muscleRegex) || [];
    
    if (matches.length > 0) {
      // Check context
      const isAvoid = /\b(sore|tired|rest|avoid|skip|no)\b/i.test(message);
      const isTarget = /\b(work|hit|focus|target|add)\b/i.test(message);
      
      if (isAvoid) {
        result.toAvoid = matches.map(m => m.toLowerCase());
        result.hasChanges = true;
      } else if (isTarget) {
        result.targetsToAdd = matches.map(m => m.toLowerCase());
        result.hasChanges = true;
      }
    }
    
    return result;
  }

  /**
   * Parse joint updates
   */
  private static parseJointUpdates(message: string, current: ParsedPreferences): string[] {
    const jointPatterns = ['knees?', 'shoulders?', 'wrists?', 'elbows?', 'ankles?', 'hips?', 'back', 'neck'];
    const jointRegex = new RegExp(`\\b(${jointPatterns.join('|')})\\b`, 'gi');
    
    const matches = message.match(jointRegex) || [];
    const hasJointIssue = /\b(hurt|hurting|pain|sore|protect|careful|issue|problem|ache|aching)\b/i.test(message);
    
    if (matches.length > 0 && hasJointIssue) {
      return matches.map(m => m.toLowerCase().replace(/s$/, '')); // Remove plural 's'
    }
    
    return [];
  }

  /**
   * Check if message has update intent
   */
  private static hasUpdateIntent(message: string): boolean {
    const updateWords = /\b(actually|instead|change|update|switch|add|remove|also|plus|now|today|feeling|want|let's|make)\b/i;
    return updateWords.test(message);
  }

  /**
   * Determine the type of update
   */
  private static determineUpdateType(message: string): UpdateParseResult['updateType'] {
    const hasAdd = this.UPDATE_PATTERNS.add.test(message);
    const hasRemove = this.UPDATE_PATTERNS.remove.test(message);
    const hasChange = this.UPDATE_PATTERNS.change.test(message);
    
    // Check for intensity-specific phrases that indicate change
    const hasIntensityChange = /\b(kick|push|challenge|destroy|crush|easy|light|hard)\b/i.test(message);
    
    if ((hasAdd || hasIntensityChange) && hasRemove) return 'mixed';
    if (hasAdd && hasIntensityChange) return 'mixed';
    if (hasChange || hasIntensityChange) return 'change';
    if (hasAdd) return 'add';
    if (hasRemove) return 'remove';
    
    return 'change'; // Default to change if intent is unclear
  }


  /**
   * Generate a confirmation message for updates
   */
  static generateUpdateConfirmation(
    updateResult: UpdateParseResult,
    targetedFollowupService: any
  ): string {
    if (!updateResult.hasUpdates) {
      return "I didn't catch any changes you'd like to make. Could you rephrase what you'd like to update?";
    }

    const { fieldsUpdated, updates } = updateResult;
    
    // Use the TargetedFollowupService method for consistent messaging
    return targetedFollowupService.generateUpdateResponse(fieldsUpdated);
  }
}