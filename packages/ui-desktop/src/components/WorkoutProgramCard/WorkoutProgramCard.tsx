"use client";

import React, { useState, useRef, useEffect } from "react";
import type { WorkoutProgramCardProps } from "./WorkoutProgramCard.types";
import { cn, Button, ExerciseItem, Icon } from "@acme/ui-shared";

// Block color configuration
const BLOCK_COLORS = {
  "Block A": { 
    border: "border-blue-200", 
    bg: "bg-blue-50", 
    hover: "hover:bg-blue-50", 
    icon: "bg-blue-200", 
    iconText: "text-blue-800",
    numberText: "text-blue-800 font-bold"
  },
  "Block B": { 
    border: "border-green-200", 
    bg: "bg-green-50", 
    hover: "hover:bg-green-50", 
    icon: "bg-green-200", 
    iconText: "text-green-800",
    numberText: "text-green-800 font-bold"
  },
  "Block C": { 
    border: "border-red-200", 
    bg: "bg-red-50", 
    hover: "hover:bg-red-50", 
    icon: "bg-red-200", 
    iconText: "text-red-800",
    numberText: "text-red-800 font-bold"
  },
  "Block D": { 
    border: "border-yellow-200", 
    bg: "bg-yellow-50", 
    hover: "hover:bg-yellow-50", 
    icon: "bg-yellow-200", 
    iconText: "text-yellow-800",
    numberText: "text-yellow-800 font-bold"
  },
  // Circuit rounds
  "Round 1": { 
    border: "border-purple-200", 
    bg: "bg-purple-50", 
    hover: "hover:bg-purple-50", 
    icon: "bg-purple-200", 
    iconText: "text-purple-800",
    numberText: "text-purple-800 font-bold"
  },
  "Round 2": { 
    border: "border-pink-200", 
    bg: "bg-pink-50", 
    hover: "hover:bg-pink-50", 
    icon: "bg-pink-200", 
    iconText: "text-pink-800",
    numberText: "text-pink-800 font-bold"
  },
  "Round 3": { 
    border: "border-orange-200", 
    bg: "bg-orange-50", 
    hover: "hover:bg-orange-50", 
    icon: "bg-orange-200", 
    iconText: "text-orange-800",
    numberText: "text-orange-800 font-bold"
  },
} as const;

export function WorkoutProgramCard({
  title,
  week,
  exercises,
  exerciseBlocks,
  onAddExercise,
  onEditExercise,
  onEditWorkout,
  onEditBlock,
  onDeleteExercise,
  onDeleteWorkout,
  onDuplicateWorkout,
  onDeleteBlock,
  onMoveExercise,
  movingExerciseId,
  isDeleting = false,
  deletingExerciseId,
  deletingBlockName,
  className,
  showEditButton = true,
}: WorkoutProgramCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [blockMenuOpen, setBlockMenuOpen] = useState<Record<string, boolean>>({});
  const [exerciseMenuOpen, setExerciseMenuOpen] = useState<Record<string, boolean>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const blockMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const blockButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const exerciseMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const exerciseButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close main menu
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
      
      // Close block menus
      Object.entries(blockMenuOpen).forEach(([blockName, isOpen]) => {
        if (isOpen) {
          const blockMenuRef = blockMenuRefs.current[blockName];
          const blockButtonRef = blockButtonRefs.current[blockName];
          if (
            blockMenuRef &&
            !blockMenuRef.contains(event.target as Node) &&
            blockButtonRef &&
            !blockButtonRef.contains(event.target as Node)
          ) {
            setBlockMenuOpen(prev => ({ ...prev, [blockName]: false }));
          }
        }
      });
      
      // Close exercise menus
      Object.entries(exerciseMenuOpen).forEach(([exerciseId, isOpen]) => {
        if (isOpen) {
          const exerciseMenuRef = exerciseMenuRefs.current[exerciseId];
          const exerciseButtonRef = exerciseButtonRefs.current[exerciseId];
          if (
            exerciseMenuRef &&
            !exerciseMenuRef.contains(event.target as Node) &&
            exerciseButtonRef &&
            !exerciseButtonRef.contains(event.target as Node)
          ) {
            setExerciseMenuOpen(prev => ({ ...prev, [exerciseId]: false }));
          }
        }
      });
    };

    if (isMenuOpen || Object.values(blockMenuOpen).some(isOpen => isOpen) || Object.values(exerciseMenuOpen).some(isOpen => isOpen)) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen, blockMenuOpen, exerciseMenuOpen]);
  return (
    <div className={cn(
      "bg-white p-8 rounded-2xl shadow-lg transition-opacity duration-200",
      isDeleting && "opacity-50",
      className
    )} data-testid="workout-card">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
          {week && <p className="text-gray-500 mt-1">{week}</p>}
        </div>
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1.5 -m-1.5"
            aria-label="More options"
            data-testid="workout-menu-button"
          >
            <Icon name="more_horiz" size={22} />
          </button>
          
          {isMenuOpen && (
            <div
              ref={menuRef}
              className="absolute right-0 mt-3 w-80 bg-white rounded-lg border-2 border-gray-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] py-3 z-50 overflow-hidden"
              data-testid="workout-menu"
            >
              <button
                onClick={() => {
                  onEditWorkout?.();
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-8 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 transition-all duration-200"
              >
                Redo Workout
              </button>
              <button
                onClick={() => {
                  onDuplicateWorkout?.();
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-8 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 transition-all duration-200"
                data-testid="duplicate-workout-option"
              >
                Duplicate Workout
              </button>
              <div className="h-px bg-gray-200 mx-4 my-2" />
              <button
                onClick={() => {
                  onDeleteWorkout?.();
                  setIsMenuOpen(false);
                }}
                disabled={isDeleting}
                className="w-full text-left px-8 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="delete-workout-option"
              >
                {isDeleting ? 'Deleting...' : 'Delete Workout'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {exerciseBlocks ? (
          // Render exercises grouped by blocks
          (() => {
            let exerciseNumber = 0; // Track exercise number across all blocks
            
            return exerciseBlocks.map((block, blockIndex) => {
              const colors = BLOCK_COLORS[block.blockName as keyof typeof BLOCK_COLORS] || BLOCK_COLORS["Block A"];
              
              return (
              <div 
                key={block.blockName}
                className={cn(
                  "transition-opacity duration-200",
                  deletingBlockName === block.blockName && "opacity-50"
                )}
                data-testid="section-block"
              >
                <div className={cn("mb-4 border-b pb-3", colors.border)}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-gray-800" data-testid="section-name">
                      {block.blockName}
                    </h4>
                    <div className="relative">
                      <button
                        ref={(el) => {
                          blockButtonRefs.current[block.blockName] = el;
                        }}
                        onClick={() => setBlockMenuOpen(prev => ({ 
                          ...prev, 
                          [block.blockName]: !prev[block.blockName] 
                        }))}
                        className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1.5 -m-1.5"
                        aria-label={`More options for ${block.blockName}`}
                        data-testid="section-menu-button"
                      >
                        <Icon name="more_horiz" size={22} />
                      </button>
                      
                      {blockMenuOpen[block.blockName] && (
                        <div
                          ref={(el) => {
                            blockMenuRefs.current[block.blockName] = el;
                          }}
                          className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg border-2 border-gray-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] py-3 z-50 overflow-hidden"
                          data-testid="section-menu"
                        >
                          <button
                            onClick={() => {
                              onAddExercise?.(block.blockName);
                              setBlockMenuOpen(prev => ({ ...prev, [block.blockName]: false }));
                            }}
                            className="w-full text-left px-8 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 transition-all duration-200"
                            data-testid="add-exercise-option"
                          >
                            Add Exercise
                          </button>
                          <div className="h-px bg-gray-200 mx-4 my-2" />
                          <button
                            onClick={() => {
                              onDeleteBlock?.(block.blockName);
                              setBlockMenuOpen(prev => ({ ...prev, [block.blockName]: false }));
                            }}
                            disabled={deletingBlockName === block.blockName}
                            className="w-full text-left px-8 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            data-testid="delete-section-option"
                          >
                            {deletingBlockName === block.blockName ? 'Deleting...' : `Delete ${block.blockName}`}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {block.exercises.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {block.exercises.map((exercise, exerciseIndex) => {
                      exerciseNumber++; // Increment exercise number for each exercise
                      
                      return (
                        <div 
                          key={exercise.id}
                          className={cn(
                            "bg-gray-50 p-4 rounded-xl flex items-center transition-all duration-200 group",
                            colors.hover,
                            movingExerciseId === exercise.id && "opacity-50",
                            deletingExerciseId === exercise.id && "opacity-50"
                          )}
                          data-testid="exercise-row"
                        >
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", colors.icon)}>
                            <span className={cn("text-lg", colors.numberText)} data-testid="exercise-sequence">{exerciseNumber}.</span>
                          </div>
                        <div className="flex-1 ml-3">
                          <p className="font-medium text-gray-800 leading-tight" data-testid="exercise-name">{exercise.name}</p>
                          <p className="text-sm text-gray-500 mt-0.5">{exercise.sets} sets</p>
                        </div>
                        {showEditButton && (
                          <div className="relative ml-2">
                            <button
                              ref={(el) => {
                                exerciseButtonRefs.current[exercise.id] = el;
                              }}
                              onClick={() => setExerciseMenuOpen(prev => ({ 
                                ...prev, 
                                [exercise.id]: !prev[exercise.id] 
                              }))}
                              className="text-gray-400 hover:text-gray-600 transition-colors p-1 -m-1 opacity-0 group-hover:opacity-100"
                              aria-label={`More options for ${exercise.name}`}
                              data-testid="exercise-menu-button"
                            >
                              <Icon name="more_vert" size={18} />
                            </button>
                            
                            {exerciseMenuOpen[exercise.id] && (
                              <div
                                ref={(el) => {
                                  exerciseMenuRefs.current[exercise.id] = el;
                                }}
                                className="absolute left-0 top-full mt-2 w-80 bg-white rounded-lg border-2 border-gray-200 shadow-[0_20px_50px_rgba(0,0,0,0.15)] py-3 z-50 overflow-hidden"
                                data-testid="exercise-menu"
                              >
                                <button
                                  onClick={() => {
                                    onEditExercise?.(exercise.id, exercise.name, block.blockName);
                                    setExerciseMenuOpen(prev => ({ ...prev, [exercise.id]: false }));
                                  }}
                                  className="w-full text-left px-8 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 transition-all duration-200"
                                  data-testid="edit-exercise-option"
                                >
                                  Edit Exercise
                                </button>
                                
                                {/* Add divider if there are move options */}
                                {(exerciseIndex > 0 || exerciseIndex < block.exercises.length - 1) && (
                                  <div className="h-px bg-gray-200 mx-4 my-2" />
                                )}
                                
                                {/* Move Up - show only if not first exercise */}
                                {exerciseIndex > 0 && (
                                  <button
                                    onClick={() => {
                                      onMoveExercise?.(exercise.id, 'up');
                                      setExerciseMenuOpen(prev => ({ ...prev, [exercise.id]: false }));
                                    }}
                                    disabled={movingExerciseId === exercise.id}
                                    className="w-full text-left px-8 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    data-testid="move-up-option"
                                  >
                                    {movingExerciseId === exercise.id ? 'Moving...' : 'Move Up'}
                                  </button>
                                )}
                                
                                {/* Move Down - show only if not last exercise */}
                                {exerciseIndex < block.exercises.length - 1 && (
                                  <button
                                    onClick={() => {
                                      onMoveExercise?.(exercise.id, 'down');
                                      setExerciseMenuOpen(prev => ({ ...prev, [exercise.id]: false }));
                                    }}
                                    disabled={movingExerciseId === exercise.id}
                                    className="w-full text-left px-8 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    data-testid="move-down-option"
                                  >
                                    {movingExerciseId === exercise.id ? 'Moving...' : 'Move Down'}
                                  </button>
                                )}
                                
                                {/* Add divider if there are move options */}
                                {(exerciseIndex > 0 || exerciseIndex < block.exercises.length - 1) && (
                                  <div className="h-px bg-gray-200 mx-4 my-2" />
                                )}
                                
                                <button
                                  onClick={() => {
                                    onDeleteExercise?.(exercise.id, block.blockName);
                                    setExerciseMenuOpen(prev => ({ ...prev, [exercise.id]: false }));
                                  }}
                                  disabled={deletingExerciseId === exercise.id}
                                  className="w-full text-left px-8 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                  data-testid="delete-exercise-option"
                                >
                                  {deletingExerciseId === exercise.id ? 'Deleting...' : 'Delete Exercise'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={cn(
                    "py-5 px-4 rounded-lg border border-dashed",
                    colors.border,
                    "bg-gray-50/50"
                  )} data-testid="empty-section-state">
                    <div className="flex items-center justify-center gap-2">
                      <Icon 
                        name="fitness_center" 
                        size={18} 
                        className={cn("opacity-40", colors.iconText)} 
                      />
                      <p className="text-sm text-gray-500">No exercises in {block.blockName}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          });
          })()
        ) : exercises ? (
          // Render exercises without blocks (backward compatibility)
          exercises.map((exercise) => (
            <ExerciseItem
              key={exercise.id}
              name={exercise.name}
              sets={exercise.sets}
              showEditButton={showEditButton}
              onEdit={onEditExercise ? () => onEditExercise(exercise.id) : undefined}
            />
          ))
        ) : null}
      </div>
    </div>
  );
}