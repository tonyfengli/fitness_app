import { ExerciseValidationService } from './exerciseValidationService';
import { createLogger } from '../utils/logger';
import type { IExerciseUpdateParser, ExerciseUpdateIntent } from './interfaces/IExerciseUpdateParser';

const logger = createLogger('ExerciseUpdateParser');

export class ExerciseUpdateParser implements IExerciseUpdateParser {
  // Pattern matching for update intent
  private static readonly INTENT_PATTERNS = {
    add: /\b(add|include|also|plus|and|with)\b/i,
    remove: /\b(remove|skip|no|avoid|without|stop|don't|dont|exclude|delete)\b/i,
  };
  
  // Special patterns that need context
  private static readonly CONTEXT_PATTERNS = {
    negativeWant: /\b(don't|dont|do not)\s+want/i,
  };

  /**
   * Parse exercise update from message
   * Uses ExerciseValidationService for intelligent exercise matching
   */
  async parseExerciseUpdate(
    message: string,
    businessId?: string
  ): Promise<ExerciseUpdateIntent> {
    try {
      // Determine intent first
      const intent = this.determineIntent(message);
      
      if (intent === 'unknown') {
        return {
          action: 'unknown',
          exercises: [],
          rawInput: message
        };
      }

      // Extract potential exercise mentions
      const exerciseMentions = this.extractPotentialExercises(message);
      
      if (exerciseMentions.length === 0) {
        // Even with intent, no exercises found
        return {
          action: intent,
          exercises: [],
          rawInput: message
        };
      }

      // Validate exercises using the validation service
      const validatedExercises: string[] = [];
      
      for (const mention of exerciseMentions) {
        try {
          const validation = await ExerciseValidationService.validateExercises(
            [mention],
            businessId || 'default',
            intent === 'add' ? 'include' : 'avoid'
          );
          
          if (validation.validatedExercises.length > 0) {
            validatedExercises.push(...validation.validatedExercises);
          }
        } catch (error) {
          logger.warn('Exercise validation failed for mention', { mention, error });
        }
      }

      return {
        action: intent,
        exercises: [...new Set(validatedExercises)], // Remove duplicates
        rawInput: message
      };
    } catch (error) {
      logger.error('Failed to parse exercise update', error);
      return {
        action: 'unknown',
        exercises: [],
        rawInput: message
      };
    }
  }

  /**
   * Determine the intent of the update (add or remove)
   */
  private determineIntent(message: string): 'add' | 'remove' | 'unknown' {
    // Check for special context patterns first
    if (ExerciseUpdateParser.CONTEXT_PATTERNS.negativeWant.test(message)) {
      return 'remove';
    }
    
    const hasRemoveIntent = ExerciseUpdateParser.INTENT_PATTERNS.remove.test(message);
    const hasAddIntent = ExerciseUpdateParser.INTENT_PATTERNS.add.test(message);
    
    // If both intents present, prioritize remove (safer)
    if (hasRemoveIntent && hasAddIntent) {
      // Look for stronger signals
      const removeStrength = this.getIntentStrength(message, 'remove');
      const addStrength = this.getIntentStrength(message, 'add');
      
      return removeStrength > addStrength ? 'remove' : 'add';
    }
    
    if (hasRemoveIntent) return 'remove';
    if (hasAddIntent) return 'add';
    
    // Check for "want" after checking negative patterns
    if (/\bwant\b/i.test(message) && !hasRemoveIntent) {
      return 'add';
    }
    
    // Check for update context - but don't assume it's always addition
    const hasUpdateContext = /\b(actually|instead|change|update)\b/i.test(message);
    if (hasUpdateContext && !hasRemoveIntent && !hasAddIntent) {
      // Only default to 'add' if there's update context but no clear intent
      return 'unknown';
    }
    
    return 'unknown';
  }

  /**
   * Get the strength of an intent based on keyword proximity
   */
  private getIntentStrength(message: string, intent: 'add' | 'remove'): number {
    const pattern = ExerciseUpdateParser.INTENT_PATTERNS[intent];
    const matches = message.match(pattern);
    
    if (!matches) return 0;
    
    // Strong intent keywords
    const strongKeywords = {
      add: ['add', 'include', 'want'],
      remove: ['remove', 'delete', 'don\'t', 'dont']
    };
    
    const keyword = matches[0].toLowerCase();
    return strongKeywords[intent].includes(keyword) ? 2 : 1;
  }

  /**
   * Extract potential exercise mentions from message
   */
  private extractPotentialExercises(message: string): string[] {
    const mentions: string[] = [];
    
    // Split message into segments
    const segments = message.split(/[,;.!?]|\b(?:and|or|also|plus)\b/i);
    
    for (const segment of segments) {
      // Clean up segment
      const cleaned = segment.trim().toLowerCase();
      if (!cleaned) continue;
      
      // Remove intent words to isolate exercise names
      let exercisePart = cleaned;
      
      // Remove negations and intent patterns
      exercisePart = exercisePart
        .replace(ExerciseUpdateParser.CONTEXT_PATTERNS.negativeWant, '')
        .replace(/\b(want|wants|wanted)\b/gi, '');
        
      for (const pattern of Object.values(ExerciseUpdateParser.INTENT_PATTERNS)) {
        exercisePart = exercisePart.replace(pattern, '').trim();
      }
      
      // Remove common filler words
      exercisePart = exercisePart
        .replace(/\b(the|that|those|these|some|any|to|from|my|workout|actually|i)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (exercisePart && exercisePart.length > 2) {
        mentions.push(exercisePart);
        logger.debug('Extracted exercise mention', { original: segment, cleaned: exercisePart });
      }
    }
    
    return mentions;
  }
}

// Export singleton instance
export const exerciseUpdateParser = new ExerciseUpdateParser();