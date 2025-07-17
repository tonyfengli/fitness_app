import React, { useState, useRef, useEffect } from "react";
import type { WorkoutProgramCardProps } from "./WorkoutProgramCard.types";
import { cn, Button, ExerciseItem, Icon } from "@acme/ui-shared";

// Block color configuration
const BLOCK_COLORS = {
  "Block A": { 
    border: "border-indigo-200", 
    bg: "bg-indigo-50", 
    hover: "hover:bg-indigo-50", 
    icon: "bg-indigo-100", 
    iconText: "text-indigo-500" 
  },
  "Block B": { 
    border: "border-green-200", 
    bg: "bg-green-50", 
    hover: "hover:bg-green-50", 
    icon: "bg-green-100", 
    iconText: "text-green-500" 
  },
  "Block C": { 
    border: "border-red-200", 
    bg: "bg-red-50", 
    hover: "hover:bg-red-50", 
    icon: "bg-red-100", 
    iconText: "text-red-500" 
  },
  "Block D": { 
    border: "border-yellow-200", 
    bg: "bg-yellow-50", 
    hover: "hover:bg-yellow-50", 
    icon: "bg-yellow-100", 
    iconText: "text-yellow-500" 
  },
  // Circuit rounds
  "Round 1": { 
    border: "border-purple-200", 
    bg: "bg-purple-50", 
    hover: "hover:bg-purple-50", 
    icon: "bg-purple-100", 
    iconText: "text-purple-500" 
  },
  "Round 2": { 
    border: "border-pink-200", 
    bg: "bg-pink-50", 
    hover: "hover:bg-pink-50", 
    icon: "bg-pink-100", 
    iconText: "text-pink-500" 
  },
  "Round 3": { 
    border: "border-orange-200", 
    bg: "bg-orange-50", 
    hover: "hover:bg-orange-50", 
    icon: "bg-orange-100", 
    iconText: "text-orange-500" 
  },
} as const;

export function WorkoutProgramCard({
  title,
  week,
  exercises,
  exerciseBlocks,
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
  onDeleteWorkout,
  onDeleteBlock,
  isDeleting = false,
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
    <div className={cn("bg-white p-8 rounded-2xl shadow-lg", className)}>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
          {week && <p className="text-gray-500">{week}</p>}
        </div>
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-2 -m-2"
            aria-label="More options"
          >
            <Icon name="more_horiz" size={24} />
          </button>
          
          {isMenuOpen && (
            <div
              ref={menuRef}
              className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
            >
              <button
                onClick={() => {
                  onDeleteWorkout?.();
                  setIsMenuOpen(false);
                }}
                disabled={isDeleting}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="delete" className="inline mr-2" size={16} />
                {isDeleting ? 'Deleting...' : 'Delete Workout'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {exerciseBlocks ? (
          // Render exercises grouped by blocks
          exerciseBlocks.map((block, blockIndex) => {
            const colors = BLOCK_COLORS[block.blockName as keyof typeof BLOCK_COLORS] || BLOCK_COLORS["Block A"];
            
            return (
              <div key={block.blockName}>
                <div className={cn("mb-4 border-b pb-2", colors.border)}>
                  <div className="flex items-center">
                    <h4 className="text-xl font-semibold text-gray-800">
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
                        className="ml-2 text-gray-400 hover:text-gray-600 transition-colors duration-200 flex items-center"
                        aria-label={`More options for ${block.blockName}`}
                      >
                        <Icon name="more_horiz" size={20} />
                      </button>
                      
                      {blockMenuOpen[block.blockName] && (
                        <div
                          ref={(el) => {
                            blockMenuRefs.current[block.blockName] = el;
                          }}
                          className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                        >
                          <button
                            onClick={() => {
                              onDeleteBlock?.(block.blockName);
                              setBlockMenuOpen(prev => ({ ...prev, [block.blockName]: false }));
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150"
                          >
                            <Icon name="delete" className="inline mr-2" size={16} />
                            Delete {block.blockName}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {block.exercises.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {block.exercises.map((exercise) => (
                      <div 
                        key={exercise.id}
                        className={cn(
                          "bg-gray-50 p-5 rounded-xl flex items-center transition-colors duration-200",
                          colors.hover
                        )}
                      >
                        <div className={cn("p-3 rounded-full mr-4", colors.icon)}>
                          <Icon name="fitness_center" className={colors.iconText} />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{exercise.name}</p>
                          <p className="text-sm text-gray-500">{exercise.sets} sets</p>
                        </div>
                        {showEditButton && (
                          <div className="relative ml-4">
                            <button
                              ref={(el) => {
                                exerciseButtonRefs.current[exercise.id] = el;
                              }}
                              onClick={() => setExerciseMenuOpen(prev => ({ 
                                ...prev, 
                                [exercise.id]: !prev[exercise.id] 
                              }))}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                              aria-label={`More options for ${exercise.name}`}
                            >
                              <Icon name="more_horiz" size={20} />
                            </button>
                            
                            {exerciseMenuOpen[exercise.id] && (
                              <div
                                ref={(el) => {
                                  exerciseMenuRefs.current[exercise.id] = el;
                                }}
                                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                              >
                                <button
                                  onClick={() => {
                                    onDeleteExercise?.(exercise.id, block.blockName);
                                    setExerciseMenuOpen(prev => ({ ...prev, [exercise.id]: false }));
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150"
                                >
                                  <Icon name="delete" className="inline mr-2" size={16} />
                                  Delete Exercise
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={cn(
                    "py-3 px-4 rounded-lg border border-dashed text-center",
                    colors.border
                  )}>
                    <div className="flex items-center justify-center gap-2">
                      <Icon 
                        name="fitness_center" 
                        size={20} 
                        className={cn("opacity-40", colors.iconText)} 
                      />
                      <p className="text-sm text-gray-500">No exercises in {block.blockName}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
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