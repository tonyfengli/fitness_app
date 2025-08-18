"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button, Icon } from "@acme/ui-shared";

import { useTRPC } from "~/trpc/react";

interface NewTrainingSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SessionFormData {
  selectedTemplate: string;
  sessionName: string;
  duration: number;
}

const STEPS = [
  { number: 1, label: "Select Template" },
  { number: 2, label: "Session Details" },
];

// Template options - currently only BMF, but new templates coming soon
const WORKOUT_TEMPLATES = [
  {
    value: "full_body_bmf",
    label: "Full Body BMF",
    description:
      "Bold Movement Fitness full body workout with 4 sequential rounds",
  },
  {
    value: "standard",
    label: "Standard Group Workout",
    description:
      "Two-phase workout generation: exercise selection followed by round programming",
  },
];

// Duration options in minutes
const DURATION_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

function ProgressIndicator({
  currentStep,
  steps,
}: {
  currentStep: number;
  steps: typeof STEPS;
}) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => (
        <div key={step.number} className="flex flex-1 items-center">
          <div className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                currentStep >= step.number
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {step.number}
            </div>
            <span
              className={`ml-2 text-sm font-medium ${
                currentStep >= step.number ? "text-gray-900" : "text-gray-500"
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`mx-4 h-0.5 flex-1 ${
                currentStep > step.number ? "bg-indigo-600" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function NewTrainingSessionModal({
  isOpen,
  onClose,
}: NewTrainingSessionModalProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Get user session data
  const { data: session } = useQuery(trpc.auth.getSession.queryOptions());

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<SessionFormData>({
    selectedTemplate: "",
    sessionName: "",
    duration: 60, // Default 1 hour
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Create session mutation
  const createSessionMutation = useMutation(
    trpc.trainingSession.create.mutationOptions(),
  );

  const resetModalState = useCallback(() => {
    setCurrentStep(1);
    setFormData({
      selectedTemplate: "",
      sessionName: "",
      duration: 60,
    });
    setError(null);
    setIsLoading(false);
  }, []);

  const handleTemplateSelect = useCallback((template: string) => {
    const templateInfo = WORKOUT_TEMPLATES.find((t) => t.value === template);
    setFormData((prev) => ({
      ...prev,
      selectedTemplate: template,
      sessionName: templateInfo?.label || template,
    }));
    setCurrentStep(2);
  }, []);

  const handleBack = useCallback(() => {
    setCurrentStep(1);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetModalState();
    onClose();
  }, [onClose, resetModalState]);

  const handleConfirm = useCallback(async () => {
    if (!formData.sessionName.trim()) {
      setError("Please enter a session name");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!session?.user?.businessId) {
        throw new Error("No business ID found. Please log in again.");
      }

      const newSession = await createSessionMutation.mutateAsync({
        businessId: session.user.businessId,
        trainerId: session.user.id, // Add trainer ID from session
        name: formData.sessionName,
        scheduledAt: new Date(), // Always "now"
        durationMinutes: formData.duration,
        maxParticipants: undefined, // Optional - undefined instead of null
        templateType: formData.selectedTemplate, // Pass the selected template
      });

      // Success - refresh sessions and close modal
      await queryClient.invalidateQueries({
        queryKey: [["trainingSession", "list"]],
      });
      resetModalState();
      onClose();

      // Navigate to the session lobby
      router.push(`/session-lobby?sessionId=${newSession.id}`);
    } catch (error) {
      setError("There was a problem creating the session. Please try again.");
      console.error("Failed to create session:", error);
    } finally {
      setIsLoading(false);
    }
  }, [
    formData,
    createSessionMutation,
    session,
    queryClient,
    resetModalState,
    onClose,
  ]);

  const formatCurrentDateTime = () => {
    const now = new Date();
    return now.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black bg-opacity-50"
        onClick={handleClose}
      >
        {/* Modal */}
        <div className="flex h-full items-center justify-center p-4">
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex-shrink-0 border-b px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    New Training Session
                  </h2>
                  <p className="mt-1 text-gray-500">
                    Schedule a new session for your clients
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="text-gray-400 transition-colors hover:text-gray-600"
                >
                  <Icon name="close" size={24} />
                </button>
              </div>
            </div>

            {/* Progress indicator */}
            <div className="flex-shrink-0 border-b bg-gray-50 px-8 py-4">
              <ProgressIndicator currentStep={currentStep} steps={STEPS} />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="mb-3 block text-sm font-medium text-gray-700">
                      Select Workout Template
                    </label>
                    <div className="space-y-3">
                      {WORKOUT_TEMPLATES.map((template) => (
                        <button
                          key={template.value}
                          onClick={() => handleTemplateSelect(template.value)}
                          className="w-full rounded-lg border-2 border-gray-300 px-4 py-4 text-left transition-all hover:border-indigo-400 hover:bg-indigo-50"
                        >
                          <div className="font-medium text-gray-900">
                            {template.label}
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            {template.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-4 text-lg font-medium text-gray-900">
                      Confirm Session Details
                    </h3>

                    {/* Session Name */}
                    <div className="mb-6">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Session Name
                      </label>
                      <input
                        type="text"
                        value={formData.sessionName}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            sessionName: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        placeholder="Enter session name"
                      />
                    </div>

                    {/* Date/Time (Read-only) */}
                    <div className="mb-6">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Date & Time
                      </label>
                      <div className="rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-gray-700">
                        {formatCurrentDateTime()}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Session will start immediately
                      </p>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Duration
                      </label>
                      <select
                        value={formData.duration}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            duration: parseInt(e.target.value),
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      >
                        {DURATION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Error message */}
                    {error && (
                      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="text-sm text-red-600">{error}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 justify-between border-t bg-gray-50 px-8 py-6">
              <div>
                {currentStep === 2 && (
                  <Button
                    onClick={handleBack}
                    variant="secondary"
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                )}
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={handleClose}
                  variant="secondary"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                {currentStep === 1 && (
                  <Button
                    onClick={() => setCurrentStep(2)}
                    disabled={!formData.selectedTemplate}
                  >
                    Next
                  </Button>
                )}
                {currentStep === 2 && (
                  <Button
                    onClick={handleConfirm}
                    disabled={isLoading || !formData.sessionName.trim()}
                  >
                    {isLoading ? "Creating..." : "Create Session"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
