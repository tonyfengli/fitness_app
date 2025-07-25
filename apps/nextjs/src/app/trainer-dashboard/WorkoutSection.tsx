import React from "react";
import { WorkoutProgramCard } from "@acme/ui-desktop";
import { FeedbackSection, Icon } from "@acme/ui-shared";
import type { ExerciseBlock } from "@acme/ui-desktop";

interface WorkoutData {
  id: string;
  createdAt: Date;
  exerciseBlocks: ExerciseBlock[];
}

interface WorkoutSectionProps {
  workoutId: string;
  date: string;
  week?: string;
  exerciseBlocks: ExerciseBlock[];
  feedbackExpanded: boolean;
  llmOutputExpanded: boolean;
  onFeedbackToggle: () => void;
  onLlmOutputToggle: () => void;
  onDeleteWorkout: (workoutId: string) => void;
  onDuplicateWorkout: () => void;
  onDeleteBlock: (workoutId: string, blockName: string) => void;
  onDeleteExercise: (workoutId: string, exerciseId: string) => void;
  onAddExercise: (workoutId: string, blockName: string) => void;
  onMoveExercise: (workoutId: string, exerciseId: string, direction: 'up' | 'down') => void;
  onEditWorkout: (workoutId: string) => void;
  onEditBlock: (workoutId: string, blockName: string) => void;
  onEditExercise: (workoutId: string, exerciseId: string, exerciseName: string, blockName: string) => void;
  deletingWorkoutId: string | null;
  deletingBlockName: string | null;
  deletingExerciseId: string | null;
  movingExerciseId: string | null;
  llmOutput?: any;
}

export function WorkoutSection({
  workoutId,
  date,
  week = "Standard, Individual",
  exerciseBlocks,
  feedbackExpanded,
  llmOutputExpanded,
  onFeedbackToggle,
  onLlmOutputToggle,
  onDeleteWorkout,
  onDuplicateWorkout,
  onDeleteBlock,
  onDeleteExercise,
  onAddExercise,
  onMoveExercise,
  onEditWorkout,
  onEditBlock,
  onEditExercise,
  deletingWorkoutId,
  deletingBlockName,
  deletingExerciseId,
  movingExerciseId,
  llmOutput
}: WorkoutSectionProps) {
  const DEFAULT_WORKOUT_WEEK = "Standard, Individual";
  const LLM_OUTPUT_TEXT = "Generated workout based on client profile: Moderate strength, Moderate skill level. Focus on compound movements with progressive overload. 3 sets of 8-12 reps for primary exercises.";
  
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-lg">
        <WorkoutProgramCard
          title={date}
          week={week || DEFAULT_WORKOUT_WEEK}
          exerciseBlocks={exerciseBlocks}
          onAddExercise={(blockName) => onAddExercise(workoutId, blockName)}
          onEditExercise={(exerciseId, exerciseName, blockName) => onEditExercise(workoutId, exerciseId, exerciseName, blockName)}
          onEditWorkout={() => onEditWorkout(workoutId)}
          onEditBlock={(blockName) => onEditBlock(workoutId, blockName)}
          onDeleteExercise={(exerciseId, blockName) => onDeleteExercise(workoutId, exerciseId)}
          onDeleteWorkout={() => onDeleteWorkout(workoutId)}
          onDuplicateWorkout={onDuplicateWorkout}
          onDeleteBlock={(blockName) => onDeleteBlock(workoutId, blockName)}
          onMoveExercise={(exerciseId, direction) => onMoveExercise(workoutId, exerciseId, direction)}
          movingExerciseId={movingExerciseId}
          isDeleting={deletingWorkoutId === workoutId}
          deletingExerciseId={deletingExerciseId}
          deletingBlockName={deletingBlockName}
          className="rounded-2xl shadow-none"
        />
        {/* LLM Output Section */}
        <div className="border-t border-gray-200">
          <button
            onClick={onLlmOutputToggle}
            className="w-full flex justify-between items-center p-6 text-left hover:bg-gray-50 transition-colors duration-200"
          >
            <div className="flex items-center gap-4">
              <span className="text-lg font-semibold text-gray-700">LLM Output</span>
              {llmOutput?.processingTime && (
                <span className="text-sm text-gray-500">
                  Generated in {llmOutput.processingTime.toFixed(2)}s
                </span>
              )}
            </div>
            <Icon 
              name={llmOutputExpanded ? "expand_less" : "expand_more"} 
              className="text-gray-400"
            />
          </button>
          {llmOutputExpanded && (
            <div className="px-6 pb-6">
              <div className="p-4 bg-gray-50 rounded-xl">
                {llmOutput ? (
                  <div className="space-y-4">
                    {/* Show system prompt */}
                    {llmOutput.systemPrompt && (
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">System Prompt</h4>
                        <details className="text-sm">
                          <summary className="cursor-pointer hover:text-gray-800 font-medium text-indigo-600">
                            Click to view system prompt
                          </summary>
                          <pre className="mt-2 p-3 bg-white rounded-lg text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap font-mono">
                            {llmOutput.systemPrompt}
                          </pre>
                        </details>
                      </div>
                    )}
                    
                    {/* Show LLM raw response */}
                    {llmOutput.rawResponse && (
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">LLM Response</h4>
                        <details className="text-sm">
                          <summary className="cursor-pointer hover:text-gray-800 font-medium text-indigo-600">
                            Click to view raw LLM response
                          </summary>
                          <pre className="mt-2 p-3 bg-white rounded-lg text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap font-mono">
                            {llmOutput.rawResponse}
                          </pre>
                        </details>
                      </div>
                    )}
                    
                    {/* Show parsed response in a more readable format */}
                    {llmOutput.parsedResponse && (
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Parsed Response</h4>
                        <div className="space-y-3">
                          {/* For group workouts, show round information */}
                          {llmOutput.parsedResponse.round3 && (
                            <div className="border-l-4 border-indigo-200 pl-4">
                              <h5 className="font-medium text-gray-700 mb-1">Round 3</h5>
                              <p className="text-sm text-gray-600 mb-2">{llmOutput.parsedResponse.round3.reasoning}</p>
                              <div className="space-y-1">
                                {llmOutput.parsedResponse.round3.exercises?.map((exercise: any, idx: number) => (
                                  <div key={idx} className="text-sm text-gray-600">
                                    {exercise.type === 'shared' ? (
                                      <span>
                                        <span className="font-medium">{exercise.name}</span> (Shared: {exercise.clients?.join(', ')})
                                      </span>
                                    ) : (
                                      <span>
                                        <span className="font-medium">{exercise.exercise}</span> ({exercise.client})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {llmOutput.parsedResponse.round4 && (
                            <div className="border-l-4 border-indigo-200 pl-4">
                              <h5 className="font-medium text-gray-700 mb-1">Round 4</h5>
                              <p className="text-sm text-gray-600 mb-2">{llmOutput.parsedResponse.round4.reasoning}</p>
                              <div className="space-y-1">
                                {llmOutput.parsedResponse.round4.exercises?.map((exercise: any, idx: number) => (
                                  <div key={idx} className="text-sm text-gray-600">
                                    {exercise.type === 'shared' ? (
                                      <span>
                                        <span className="font-medium">{exercise.name}</span> (Shared: {exercise.clients?.join(', ')})
                                      </span>
                                    ) : (
                                      <span>
                                        <span className="font-medium">{exercise.exercise}</span> ({exercise.client})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* For individual workouts, show block details */}
                          {!llmOutput.parsedResponse.round3 && Object.entries(llmOutput.parsedResponse).map(([key, value]) => {
                            if (key === 'reasoning' || key === 'timing' || !Array.isArray(value)) return null;
                            
                            const blockName = key.replace('block', 'Block ').toUpperCase();
                            return (
                              <div key={key} className="border-l-4 border-indigo-200 pl-4">
                                <h5 className="font-medium text-gray-700 mb-1">{blockName}</h5>
                                <div className="space-y-1">
                                  {value.map((exercise: any, idx: number) => (
                                    <div key={idx} className="text-sm text-gray-600">
                                      <span className="font-medium">{exercise.exercise}</span>
                                      {exercise.sets && <span> - {exercise.sets} sets</span>}
                                      {exercise.reps && <span> x {exercise.reps} reps</span>}
                                      {exercise.rest && <span> ({exercise.rest} rest)</span>}
                                      {exercise.notes && <div className="text-xs text-gray-500 mt-1">{exercise.notes}</div>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Show metadata */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-xs text-gray-500 space-y-1">
                        {llmOutput.llmModel && <div>Model: {llmOutput.llmModel}</div>}
                        {llmOutput.timestamp && <div>Generated: {new Date(llmOutput.timestamp).toLocaleString()}</div>}
                        {llmOutput.userMessage && <div>Prompt: {llmOutput.userMessage}</div>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600">{LLM_OUTPUT_TEXT}</p>
                )}
              </div>
            </div>
          )}
        </div>
        {/* Client Feedback Section */}
        <div className="border-t border-gray-200">
          <FeedbackSection
            isExpanded={feedbackExpanded}
            onToggle={onFeedbackToggle}
            onAddNote={() => console.log("Add note")}
            className="rounded-b-2xl"
          />
        </div>
      </div>
    </div>
  );
}