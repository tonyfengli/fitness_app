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
                  <h2 className="text-2xl font-bold text-gray-900">{clientName}'s Favorite Exercises</h2>
                  <p className="text-gray-500 mt-1">View and manage favorite exercises for {clientName}</p>
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
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {favorites.length === 0 ? (
                <div className="text-center py-12">
                  <Icon name="star" size={48} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No favorite exercises yet</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Favorite exercises will appear here when {clientName} marks them
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {favorites.map((favorite) => (
                    <div key={favorite.id} className="rounded-lg border p-4 hover:bg-gray-50 transition-colors">
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
                        <Icon name="star" size={20} className="text-yellow-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
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