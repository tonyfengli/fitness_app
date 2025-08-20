"use client";

import React from "react";
import { Button, Icon } from "@acme/ui-shared";

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
}

export default function FavoritesModal({
  isOpen,
  onClose,
  clientName,
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
              <div className="space-y-4">
                <div className="rounded-lg border p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Barbell Back Squat</h3>
                      <p className="text-sm text-gray-600">Primary: Quads • Secondary: Glutes</p>
                    </div>
                    <Icon name="star" size={20} className="text-yellow-500" />
                  </div>
                </div>

                <div className="rounded-lg border p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Dumbbell Bench Press</h3>
                      <p className="text-sm text-gray-600">Primary: Chest • Secondary: Triceps</p>
                    </div>
                    <Icon name="star" size={20} className="text-yellow-500" />
                  </div>
                </div>

                <div className="rounded-lg border p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Pull-ups</h3>
                      <p className="text-sm text-gray-600">Primary: Lats • Secondary: Biceps</p>
                    </div>
                    <Icon name="star" size={20} className="text-yellow-500" />
                  </div>
                </div>

                <div className="rounded-lg border p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Romanian Deadlift</h3>
                      <p className="text-sm text-gray-600">Primary: Hamstrings • Secondary: Glutes</p>
                    </div>
                    <Icon name="star" size={20} className="text-yellow-500" />
                  </div>
                </div>
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