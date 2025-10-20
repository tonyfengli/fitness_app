"use client";

import { useState } from "react";
import { ChevronLeftIcon, CheckIcon } from "@acme/ui-shared";

// Types for form data
interface FeedbackData {
  challengeLevel: string | null;
  favoriteRound: string | null;
  leastEffectiveRound: string | null;
  additionalComments: string;
}

// Hard-coded round data for the feedback form
const ROUNDS = [
  { id: "1", name: "Round 1", type: "Circuit", description: "High-intensity cardio circuits" },
  { id: "2", name: "Round 2", type: "Stations", description: "Strength-focused stations" },
  { id: "3", name: "Round 3", type: "AMRAP", description: "As many reps as possible" },
  { id: "4", name: "Round 4", type: "Circuit", description: "Core and conditioning" },
];

export default function CircuitFeedbackPage() {
  const [formData, setFormData] = useState<FeedbackData>({
    challengeLevel: null,
    favoriteRound: null,
    leastEffectiveRound: null,
    additionalComments: "",
  });

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  const handleSubmit = () => {
    console.log("Feedback submitted:", formData);
    // TODO: Handle form submission
    alert("Thank you for your feedback!");
  };

  const isStepComplete = (step: number) => {
    switch (step) {
      case 1:
        return formData.challengeLevel !== null;
      case 2:
        return formData.favoriteRound !== null;
      case 3:
        return formData.leastEffectiveRound !== null;
      case 4:
        return true; // Comments are optional
      default:
        return false;
    }
  };

  const canProceed = isStepComplete(currentStep);
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (currentStep > 1) {
                  setCurrentStep(currentStep - 1);
                } else {
                  window.history.back();
                }
              }}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Workout Feedback
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Step {currentStep} of {totalSteps}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-4 pb-4">
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i + 1 <= currentStep ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-8">
        {/* Step 1: Challenge Level */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                How challenging was today's workout?
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Help us understand if the intensity was right for you
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  value: "too_easy",
                  label: "Too Easy",
                  description: "I could have done more",
                  color: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300",
                  selectedColor: "bg-green-600 border-green-600 text-white"
                },
                {
                  value: "just_right",
                  label: "Just Right",
                  description: "Perfect challenge level",
                  color: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300",
                  selectedColor: "bg-blue-600 border-blue-600 text-white"
                },
                {
                  value: "too_hard",
                  label: "Too Hard",
                  description: "Struggled to keep up",
                  color: "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300",
                  selectedColor: "bg-orange-600 border-orange-600 text-white"
                }
              ].map((option) => {
                const isSelected = formData.challengeLevel === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setFormData({ ...formData, challengeLevel: option.value })}
                    className={`w-full p-6 rounded-xl border-2 transition-all text-left ${
                      isSelected ? option.selectedColor : option.color
                    } hover:shadow-md active:scale-98 transform`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? "border-white" : "border-current"
                      }`}>
                        {isSelected && <CheckIcon className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">{option.label}</h3>
                        <p className={`text-sm mt-1 ${isSelected ? "text-white/80" : "opacity-75"}`}>
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Favorite Round */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Which round was your favorite?
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Tell us which format worked best for you
              </p>
            </div>

            <div className="space-y-3">
              {ROUNDS.map((round) => {
                const isSelected = formData.favoriteRound === round.id;
                return (
                  <button
                    key={round.id}
                    onClick={() => setFormData({ ...formData, favoriteRound: round.id })}
                    className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? "border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-950/20"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                    } hover:shadow-md active:scale-98 transform`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-purple-600 border-purple-600 text-white"
                          : "border-gray-300 dark:border-gray-600"
                      }`}>
                        {isSelected && <CheckIcon className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                            {round.name}
                          </h3>
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium">
                            {round.type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {round.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Least Effective Round */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Which round felt least effective?
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Help us identify areas for improvement
              </p>
            </div>

            <div className="space-y-3">
              {ROUNDS.map((round) => {
                const isSelected = formData.leastEffectiveRound === round.id;
                return (
                  <button
                    key={round.id}
                    onClick={() => setFormData({ ...formData, leastEffectiveRound: round.id })}
                    className={`w-full p-5 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-950/20"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
                    } hover:shadow-md active:scale-98 transform`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-red-600 border-red-600 text-white"
                          : "border-gray-300 dark:border-gray-600"
                      }`}>
                        {isSelected && <CheckIcon className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                            {round.name}
                          </h3>
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium">
                            {round.type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {round.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4: Additional Comments */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Additional Comments
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Share any other thoughts about today's workout (optional)
              </p>
            </div>

            <div className="space-y-4">
              <textarea
                value={formData.additionalComments}
                onChange={(e) => setFormData({ ...formData, additionalComments: e.target.value })}
                placeholder="Tell us more about your experience, suggestions for improvement, or anything else you'd like to share..."
                rows={6}
                className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
              />
              
              {/* Character count */}
              <div className="text-right">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formData.additionalComments.length} characters
                </span>
              </div>

              {/* Summary of previous selections */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Your Feedback Summary:</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Challenge Level:</span>
                    <span className="font-medium text-gray-900 dark:text-white capitalize">
                      {formData.challengeLevel?.replace('_', ' ') || 'Not selected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Favorite Round:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {ROUNDS.find(r => r.id === formData.favoriteRound)?.name || 'Not selected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Least Effective:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {ROUNDS.find(r => r.id === formData.leastEffectiveRound)?.name || 'Not selected'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-3">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Previous
            </button>
          )}
          
          <button
            onClick={() => {
              if (isLastStep) {
                handleSubmit();
              } else {
                setCurrentStep(currentStep + 1);
              }
            }}
            disabled={!canProceed}
            className={`flex-1 py-3 px-6 rounded-lg font-medium transition-colors ${
              canProceed
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            }`}
          >
            {isLastStep ? "Submit Feedback" : "Continue"}
          </button>
        </div>
      </div>

      {/* Bottom Safe Area */}
      <div className="h-20" />
    </div>
  );
}