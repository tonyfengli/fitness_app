import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateWorkoutFromExercises, setInterpretationLLM } from '../../../src/workout-generation/generateWorkoutFromExercises';
import type { WorkoutInterpretationStateType } from '../../../src/workout-generation/types';
import type { ClientContext } from '../../../src/types/clientContext';

describe('Template Integration with LLM Handler', () => {
  let mockLLM: any;
  
  beforeEach(() => {
    // Create a mock LLM that captures the prompt
    mockLLM = {
      invoke: vi.fn().mockImplementation((messages) => {
        // Extract the system message content
        const systemMessage = messages.find((m: any) => m.constructor.name === 'SystemMessage');
        const systemContent = systemMessage?.content || '';
        
        // Return a mock response based on the template type detected in the prompt
        let mockResponse;
        if (systemContent.includes('Round 1') && systemContent.includes('Round 2')) {
          // Circuit template detected
          mockResponse = {
            blocks: {
              round1: [
                { name: "Jump Squats", sets: 1, reps: "45 seconds" },
                { name: "Push-Ups", sets: 1, reps: "45 seconds" },
                { name: "Mountain Climbers", sets: 1, reps: "45 seconds" },
                { name: "Plank", sets: 1, reps: "45 seconds" }
              ],
              round2: "Same exercises as Round 1",
              round3: "Same exercises as Round 1"
            }
          };
        } else {
          // Standard template (default)
          mockResponse = {
            blocks: {
              blockA: [{ name: "Squat", sets: 4, reps: "8-10" }],
              blockB: [
                { name: "Romanian Deadlift", sets: 3, reps: "10-12" },
                { name: "Bench Press", sets: 3, reps: "10-12" }
              ],
              blockC: [
                { name: "Lat Pulldown", sets: 3, reps: "12-15" },
                { name: "Lateral Raise", sets: 3, reps: "12-15" }
              ],
              blockD: [
                { name: "Plank", sets: 3, reps: "30-60s" },
                { name: "Dead Bug", sets: 3, reps: "10 per side" }
              ]
            }
          };
        }
        
        return {
          content: JSON.stringify(mockResponse)
        };
      })
    };
    
    setInterpretationLLM(mockLLM);
  });
  
  it('should use standard template structure when templateType is standard', async () => {
    const clientContext: ClientContext = {
      user_id: 'test-user-1',
      name: 'Test User',
      strength_capacity: 'moderate',
      skill_capacity: 'moderate',
      templateType: 'standard'
    };
    
    const state: WorkoutInterpretationStateType = {
      exercises: {
        blockA: [{ id: 'squat-1', name: 'Squat', score: 8, tags: [] }],
        blockB: [
          { id: 'rdl-1', name: 'Romanian Deadlift', score: 7, tags: [] },
          { id: 'bench-1', name: 'Bench Press', score: 7, tags: [] }
        ],
        blockC: [
          { id: 'lat-1', name: 'Lat Pulldown', score: 6, tags: [] },
          { id: 'lateral-1', name: 'Lateral Raise', score: 6, tags: [] }
        ],
        blockD: [
          { id: 'plank-1', name: 'Plank', score: 5, tags: [] },
          { id: 'deadbug-1', name: 'Dead Bug', score: 5, tags: [] }
        ]
      },
      clientContext,
      interpretation: '',
      structuredOutput: {},
      timing: {},
      error: null
    };
    
    const result = await generateWorkoutFromExercises(state);
    
    // Verify the LLM was called
    expect(mockLLM.invoke).toHaveBeenCalled();
    
    // Get the system message that was sent to the LLM
    const systemMessage = mockLLM.invoke.mock.calls[0][0]
      .find((m: any) => m.constructor.name === 'SystemMessage');
    const systemContent = systemMessage?.content || '';
    
    // Verify standard template structure is used
    expect(systemContent).toContain('Block A');
    expect(systemContent).toContain('Block B');
    expect(systemContent).toContain('Block C');
    expect(systemContent).toContain('Block D');
    expect(systemContent).toContain('Primary strength exercises');
    expect(systemContent).toContain('Secondary strength exercises');
    expect(systemContent).toContain('Accessory exercises');
    expect(systemContent).toContain('Core and capacity work');
    
    // Should NOT contain circuit-specific sections
    expect(systemContent).not.toContain('Round 1');
    expect(systemContent).not.toContain('Round 2');
    expect(systemContent).not.toContain('45s work, 15s rest');
  });
  
  it('should use circuit template structure when templateType is circuit', async () => {
    const clientContext: ClientContext = {
      user_id: 'test-user-2',
      name: 'Test User',
      strength_capacity: 'moderate',
      skill_capacity: 'moderate',
      templateType: 'circuit'
    };
    
    const state: WorkoutInterpretationStateType = {
      exercises: {
        blockA: [
          { id: 'jump-squat-1', name: 'Jump Squats', score: 8, tags: [] },
          { id: 'pushup-1', name: 'Push-Ups', score: 8, tags: [] },
          { id: 'mountain-1', name: 'Mountain Climbers', score: 7, tags: [] },
          { id: 'plank-2', name: 'Plank', score: 7, tags: [] }
        ],
        blockB: [],
        blockC: [],
        blockD: []
      },
      clientContext,
      interpretation: '',
      structuredOutput: {},
      timing: {},
      error: null
    };
    
    const result = await generateWorkoutFromExercises(state);
    
    // Verify the LLM was called
    expect(mockLLM.invoke).toHaveBeenCalled();
    
    // Get the system message that was sent to the LLM
    const systemMessage = mockLLM.invoke.mock.calls[0][0]
      .find((m: any) => m.constructor.name === 'SystemMessage');
    const systemContent = systemMessage?.content || '';
    
    // Verify circuit template structure is used
    expect(systemContent).toContain('Round 1');
    expect(systemContent).toContain('Round 2');
    expect(systemContent).toContain('Round 3');
    expect(systemContent).toContain('45s work, 15s rest');
    expect(systemContent).toContain('perform all exercises back-to-back');
    
    // Should NOT contain standard block names
    expect(systemContent).not.toContain('Block A');
    expect(systemContent).not.toContain('Primary strength exercises');
  });
  
  it('should use full_body template structure when templateType is full_body', async () => {
    const clientContext: ClientContext = {
      user_id: 'test-user-3',
      name: 'Test User',
      strength_capacity: 'moderate', 
      skill_capacity: 'moderate',
      templateType: 'full_body'
    };
    
    const state: WorkoutInterpretationStateType = {
      exercises: {
        blockA: [{ id: 'deadlift-1', name: 'Deadlift', score: 9, tags: [] }],
        blockB: [
          { id: 'pullup-1', name: 'Pull-Ups', score: 8, tags: [] },
          { id: 'ohp-1', name: 'Overhead Press', score: 8, tags: [] }
        ],
        blockC: [
          { id: 'legcurl-1', name: 'Leg Curls', score: 6, tags: [] },
          { id: 'facepull-1', name: 'Face Pulls', score: 6, tags: [] }
        ],
        blockD: [{ id: 'farmers-1', name: 'Farmers Walk', score: 7, tags: [] }]
      },
      clientContext,
      interpretation: '',
      structuredOutput: {},
      timing: {},
      error: null
    };
    
    const result = await generateWorkoutFromExercises(state);
    
    // Verify the LLM was called
    expect(mockLLM.invoke).toHaveBeenCalled();
    
    // Get the system message that was sent to the LLM
    const systemMessage = mockLLM.invoke.mock.calls[0][0]
      .find((m: any) => m.constructor.name === 'SystemMessage');
    const systemContent = systemMessage?.content || '';
    
    // Verify full body template structure is used
    expect(systemContent).toContain('Block A');
    expect(systemContent).toContain('Primary compound movements');
    expect(systemContent).toContain('balance upper/lower');
    expect(systemContent).toContain('target weak points');
    expect(systemContent).toContain('Core and conditioning');
    
    // Verify exercise limits
    expect(systemContent).toMatch(/Maximum 8 unique exercises TOTAL/);
  });
  
  it('should default to standard template when no templateType is specified', async () => {
    const clientContext: ClientContext = {
      user_id: 'test-user-4',
      name: 'Test User',
      strength_capacity: 'moderate',
      skill_capacity: 'moderate'
      // No templateType specified
    };
    
    const state: WorkoutInterpretationStateType = {
      exercises: {
        blockA: [{ id: 'squat-2', name: 'Squat', score: 8, tags: [] }],
        blockB: [],
        blockC: [],
        blockD: []
      },
      clientContext,
      interpretation: '',
      structuredOutput: {},
      timing: {},
      error: null
    };
    
    const result = await generateWorkoutFromExercises(state);
    
    // Get the system message that was sent to the LLM
    const systemMessage = mockLLM.invoke.mock.calls[0][0]
      .find((m: any) => m.constructor.name === 'SystemMessage');
    const systemContent = systemMessage?.content || '';
    
    // Should use standard template by default
    expect(systemContent).toContain('Primary strength exercises');
    expect(systemContent).toContain('Secondary strength exercises');
  });
});