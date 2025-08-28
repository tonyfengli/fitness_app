"use client";

import React from "react";
import { Button, Icon } from "@acme/ui-shared";

interface FavoriteExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  primaryMuscle: string;
  secondaryMuscles: string[] | null;
  equipment: string | null;
  movementPattern: string | null;
  modality: string | null;
  ratingType: string;
}

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  favorites?: FavoriteExercise[];
  avoidExercises?: FavoriteExercise[];
}

// Helper to format muscle names
function formatMuscleName(muscle: string): string {
  return muscle.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function FavoritesModal({
  isOpen,
  onClose,
  clientName,
  favorites = [],
  avoidExercises = [],
}: FavoritesModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      >
        {/* Modal */}
        <div className="flex items-center justify-center p-4 h-full">
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-8 py-6 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{clientName}'s Exercise Preferences</h2>
                  <p className="text-gray-500 mt-1">View favorite and avoid exercises for {clientName}</p>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Icon name="close" size={24} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
              {/* Favorites Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Icon name="star" size={20} className="text-yellow-500" />
                  Favorite Exercises ({favorites.length})
                </h3>
                {favorites.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Icon name="star" size={32} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No favorite exercises yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {favorites.map((favorite) => (
                      <div key={favorite.id} className="rounded-lg border border-green-200 bg-green-50/50 p-4 hover:bg-green-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{favorite.exerciseName}</h3>
                            <p className="text-sm text-gray-600">
                              Primary: {formatMuscleName(favorite.primaryMuscle)}
                              {favorite.secondaryMuscles && favorite.secondaryMuscles.length > 0 && (
                                <> • Secondary: {favorite.secondaryMuscles.map(formatMuscleName).join(", ")}</>
                              )}
                            </p>
                            {favorite.equipment && (
                              <p className="text-xs text-gray-500 mt-1">Equipment: {favorite.equipment}</p>
                            )}
                          </div>
                          <Icon name="thumbUp" size={20} className="text-green-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Avoid Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Icon name="thumbDown" size={20} className="text-red-500" />
                  Avoid Exercises ({avoidExercises.length})
                </h3>
                {avoidExercises.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Icon name="thumbDown" size={32} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No exercises marked to avoid</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {avoidExercises.map((exercise) => (
                      <div key={exercise.id} className="rounded-lg border border-red-200 bg-red-50/50 p-4 hover:bg-red-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{exercise.exerciseName}</h3>
                            <p className="text-sm text-gray-600">
                              Primary: {formatMuscleName(exercise.primaryMuscle)}
                              {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
                                <> • Secondary: {exercise.secondaryMuscles.map(formatMuscleName).join(", ")}</>
                              )}
                            </p>
                            {exercise.equipment && (
                              <p className="text-xs text-gray-500 mt-1">Equipment: {exercise.equipment}</p>
                            )}
                          </div>
                          <Icon name="thumbDown" size={20} className="text-red-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t bg-gray-50 flex justify-end">
              <Button onClick={onClose} variant="secondary">
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}