import React, { useState, useMemo } from "react";
import { Input, Button, Icon } from "@acme/ui-shared";
import type { AddExerciseModalProps } from "./AddExerciseModal.types";

// Group exercises by primary muscle
const groupByMuscle = (exercises: any[]) => {
  const grouped = exercises.reduce((acc, exercise) => {
    const muscle = exercise.primaryMuscle || "Other";
    if (!acc[muscle]) acc[muscle] = [];
    acc[muscle].push(exercise);
    return acc;
  }, {} as Record<string, any[]>);
  
  // Sort muscle groups alphabetically
  return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
};

// Movement pattern badge colors
const MOVEMENT_COLORS = {
  push: "bg-blue-100 text-blue-700",
  pull: "bg-green-100 text-green-700",
  squat: "bg-purple-100 text-purple-700",
  hinge: "bg-orange-100 text-orange-700",
  lunge: "bg-pink-100 text-pink-700",
  carry: "bg-yellow-100 text-yellow-700",
  isolation: "bg-gray-100 text-gray-700",
} as const;

export function AddExerciseModal({
  isOpen,
  onClose,
  onAdd,
  blockName,
  exercises = [],
}: AddExerciseModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<any | null>(null);
  const [sets, setSets] = useState(3);
  const [expandedMuscle, setExpandedMuscle] = useState<string | null>(null);

  // Filter exercises based on search
  const filteredExercises = useMemo(() => {
    if (!searchQuery.trim()) return exercises;
    
    const query = searchQuery.toLowerCase();
    return exercises.filter(exercise => 
      exercise.name.toLowerCase().includes(query) ||
      exercise.primaryMuscle?.toLowerCase().includes(query) ||
      exercise.movementPattern?.toLowerCase().includes(query)
    );
  }, [exercises, searchQuery]);

  // Group filtered exercises by muscle
  const groupedExercises = useMemo(() => 
    groupByMuscle(filteredExercises),
    [filteredExercises]
  );

  const resetState = () => {
    setSelectedExercise(null);
    setSets(3);
    setSearchQuery("");
    setExpandedMuscle(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleAdd = () => {
    if (selectedExercise) {
      onAdd(selectedExercise.id, sets);
      handleClose();
    }
  };

  const handleExerciseClick = (exercise: any) => {
    setSelectedExercise(exercise);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={handleClose}
      >
        {/* Modal */}
        <div className="flex items-center justify-center p-4 h-full">
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header */}
          <div className="px-8 py-6 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Add Exercise</h2>
                <p className="text-gray-500 mt-1">Add an exercise to {blockName}</p>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Icon name="close" size={24} />
              </button>
            </div>
          </div>
          
          {/* Search */}
          <div className="px-8 py-4 bg-gray-50 border-b flex-shrink-0">
            <div className="relative">
              <Icon 
                name="search" 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
                size={20}
              />
              <Input
                placeholder="Search by name, muscle, or movement..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Exercise List */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {groupedExercises.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No exercises found matching "{searchQuery}"
              </div>
            ) : (
              <div className="space-y-4 pb-4">
              {groupedExercises.map(([muscle, muscleExercises]) => (
                <div key={muscle} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedMuscle(expandedMuscle === muscle ? null : muscle)}
                    className="w-full px-4 py-2 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                  >
                    <span className="font-medium text-gray-700">{muscle}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{muscleExercises.length}</span>
                      <Icon 
                        name={expandedMuscle === muscle ? "expand_less" : "expand_more"} 
                        className="text-gray-400"
                        size={20}
                      />
                    </div>
                  </button>
                  
                  {expandedMuscle === muscle && (
                    <div className="divide-y divide-gray-100">
                      {muscleExercises.map((exercise) => (
                        <button
                          key={exercise.id}
                          onClick={() => handleExerciseClick(exercise)}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                            selectedExercise?.id === exercise.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">{exercise.name}</p>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {exercise.movementPattern && (
                                  <span 
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                      MOVEMENT_COLORS[exercise.movementPattern as keyof typeof MOVEMENT_COLORS] || "bg-gray-100 text-gray-700"
                                    }`}
                                  >
                                    {exercise.movementPattern}
                                  </span>
                                )}
                              </div>
                            </div>
                            {selectedExercise?.id === exercise.id && (
                              <Icon name="check" className="text-indigo-600 ml-2" size={20} />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 border-t bg-gray-50 flex-shrink-0">
            {selectedExercise && (
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-medium text-gray-800">{selectedExercise.name}</p>
                  <p className="text-sm text-gray-500">Selected exercise</p>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="sets" className="text-sm font-medium text-gray-700">
                    Sets:
                  </label>
                  <Input
                    id="sets"
                    type="number"
                    min="1"
                    max="10"
                    value={sets}
                    onChange={(e) => setSets(parseInt(e.target.value) || 3)}
                    className="w-20"
                  />
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleAdd} 
                disabled={!selectedExercise}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Add Exercise
              </Button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </>
  );
}