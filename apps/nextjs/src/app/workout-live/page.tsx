"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";

// Modern Exercise Station Component
function ExerciseStation({
  participants,
  exercise,
  phase,
  scheme,
  isShared,
  index,
}: {
  participants: { name: string; avatar: string }[];
  exercise: string;
  phase: string;
  scheme: {
    type: string;
    sets?: number;
    reps?: string;
    work?: string;
    rest?: string;
    rounds?: number;
  };
  isShared: boolean;
  index: number;
}) {
  const phaseColors = {
    main_strength: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      accent: "bg-red-500",
    },
    accessory: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      accent: "bg-blue-500",
    },
    core: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-700",
      accent: "bg-green-500",
    },
    power_conditioning: {
      bg: "bg-purple-50",
      border: "border-purple-200",
      text: "text-purple-700",
      accent: "bg-purple-500",
    },
  };

  const colors =
    phaseColors[phase as keyof typeof phaseColors] || phaseColors.main_strength;

  return (
    <div
      className={`${colors.bg} ${colors.border} w-96 transform rounded-3xl border-2 p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
    >
      {/* Station Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`${colors.accent} flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white`}
          >
            {index + 1}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{exercise}</h3>
            <p className={`text-sm ${colors.text} font-medium`}>
              {phase
                .replace("_", " ")
                .split(" ")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ")}
            </p>
          </div>
        </div>
        {isShared && (
          <div className="rounded-full bg-gray-100 px-3 py-1">
            <span className="text-xs font-semibold text-gray-600">SHARED</span>
          </div>
        )}
      </div>

      {/* Scheme Display */}
      <div className={`${colors.accent} mb-4 rounded-2xl bg-opacity-10 p-4`}>
        <div className="text-center">
          {scheme.type === "reps" ? (
            <>
              <p className="text-3xl font-bold text-gray-900">
                {scheme.sets} × {scheme.reps}
              </p>
              <p className="mt-1 text-sm text-gray-600">Sets × Reps</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900">
                {scheme.work} / {scheme.rest}
              </p>
              <p className="text-lg font-semibold text-gray-700">
                × {scheme.rounds} rounds
              </p>
              <p className="mt-1 text-sm text-gray-600">Work / Rest</p>
            </>
          )}
        </div>
      </div>

      {/* Participants */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Participants
        </p>
        <div className="flex flex-wrap gap-2">
          {participants.map((participant, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm"
            >
              <img
                src={participant.avatar}
                alt={participant.name}
                className="h-6 w-6 rounded-full"
              />
              <span className="text-sm font-medium text-gray-700">
                {participant.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Modern Timer Component
function Timer({
  timeLeft,
  phase,
  scheme,
}: {
  timeLeft: number;
  phase?: string;
  scheme?: { type: string; work?: string; rest?: string };
}) {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isTimeBased = scheme?.type === "time";
  const isPowerConditioning = phase === "power_conditioning";

  return (
    <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
      <div className="mb-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          {isTimeBased ? "Work Time" : "Round Timer"}
        </p>
      </div>
      <div className="relative">
        <div className="text-6xl font-bold tabular-nums tracking-tight text-gray-900">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
        {isTimeBased && scheme && (
          <div className="mt-4 text-sm text-gray-600">
            <span className="font-semibold">Format:</span> {scheme.work} work /{" "}
            {scheme.rest} rest
          </div>
        )}
      </div>
      {/* Progress Ring */}
      <div className="mt-6">
        <div className="relative mx-auto h-32 w-32">
          <svg className="h-32 w-32 -rotate-90 transform">
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-gray-200"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={351.86}
              strokeDashoffset={351.86 * (1 - (299 - timeLeft) / 299)}
              className={`${
                timeLeft <= 30
                  ? "text-red-500"
                  : timeLeft <= 60
                    ? "text-orange-500"
                    : isPowerConditioning
                      ? "text-purple-500"
                      : "text-blue-500"
              } transition-all duration-1000`}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

// Loading Spinner Component
function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-4 border-gray-200"></div>
          <div className="absolute left-0 top-0 h-20 w-20 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        </div>
        <p className="mt-6 font-medium text-gray-600">Loading workout...</p>
      </div>
    </div>
  );
}

function WorkoutLivePageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const round = searchParams.get("round") || "1";
  const [timeLeft, setTimeLeft] = useState(299); // 5 minutes default
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();
  const trpc = useTRPC();

  // Fetch workouts for the session
  const { data: sessionWorkouts, isLoading } = useQuery({
    ...trpc.workout.sessionWorkoutsWithExercises.queryOptions({
      sessionId: sessionId || "",
    }),
    enabled: !!sessionId,
  });

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Get all rounds and current round data
  const { rounds, currentRoundData } = React.useMemo(() => {
    if (!sessionWorkouts || sessionWorkouts.length === 0) {
      return { rounds: [], currentRoundData: null };
    }

    // Collect all unique rounds with their phase info
    const roundsMap = new Map<
      string,
      { name: string; phase: string; orderIndex: number }
    >();

    sessionWorkouts.forEach((workoutData) => {
      workoutData.exercises.forEach((ex) => {
        if (ex.groupName && ex.orderIndex !== 999 && ex.phase) {
          if (
            !roundsMap.has(ex.groupName) ||
            ex.orderIndex < roundsMap.get(ex.groupName)!.orderIndex
          ) {
            roundsMap.set(ex.groupName, {
              name: ex.groupName,
              phase: ex.phase,
              orderIndex: ex.orderIndex,
            });
          }
        }
      });
    });

    // Sort rounds by order index
    const sortedRounds = Array.from(roundsMap.values()).sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    const currentRoundData = sortedRounds[parseInt(round) - 1] || null;

    return { rounds: sortedRounds, currentRoundData };
  }, [sessionWorkouts, round]);

  // Group exercises for current round
  const stations = React.useMemo(() => {
    if (!sessionWorkouts || !currentRoundData) return [];

    // Group exercises by name
    const exerciseGroups = new Map<
      string,
      {
        exerciseName: string;
        phase: string;
        scheme: any;
        isShared: boolean;
        participants: Array<{
          userId: string;
          userName: string;
        }>;
      }
    >();

    sessionWorkouts.forEach((workoutData) => {
      const roundExercises = workoutData.exercises.filter(
        (ex) => ex.groupName === currentRoundData.name && ex.orderIndex !== 999,
      );

      roundExercises.forEach((exercise) => {
        const key = exercise.exercise.name;

        if (!exerciseGroups.has(key)) {
          exerciseGroups.set(key, {
            exerciseName: exercise.exercise.name,
            phase: exercise.phase,
            scheme: exercise.scheme,
            isShared: exercise.isShared || false,
            participants: [],
          });
        }

        exerciseGroups.get(key)!.participants.push({
          userId: workoutData.user.id,
          userName:
            workoutData.user.name || workoutData.user.email.split("@")[0],
        });
      });
    });

    return Array.from(exerciseGroups.values());
  }, [sessionWorkouts, currentRoundData]);

  // Loading state
  if (isLoading) return <LoadingSpinner />;

  // No session or no exercises
  if (!sessionId || stations.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md rounded-3xl bg-white p-12 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <svg
              className="h-10 w-10 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-xl font-semibold text-gray-900">
            {!sessionId
              ? "No Session Selected"
              : `No Exercises for Round ${round}`}
          </h3>
          <p className="text-gray-600">
            {!sessionId
              ? "Please select a valid workout session to continue."
              : "This round doesn't have any exercises assigned."}
          </p>
          <button
            onClick={() => window.history.back()}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentPhase = currentRoundData?.phase || "main_strength";
  const phaseConfig = {
    main_strength: { gradient: "from-red-500 to-orange-500", bg: "bg-red-50" },
    accessory: { gradient: "from-blue-500 to-cyan-500", bg: "bg-blue-50" },
    core: { gradient: "from-green-500 to-emerald-500", bg: "bg-green-50" },
    power_conditioning: {
      gradient: "from-purple-500 to-pink-500",
      bg: "bg-purple-50",
    },
  };

  const config =
    phaseConfig[currentPhase as keyof typeof phaseConfig] ||
    phaseConfig.main_strength;

  return (
    <div className={`min-h-screen ${config.bg} transition-colors duration-500`}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Round {round} of {rounds.length}
              </h1>
              <p className="mt-1 text-lg text-gray-600">
                {currentRoundData?.phase
                  .replace("_", " ")
                  .split(" ")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ")}
              </p>
            </div>

            {/* Round Progress Indicators and Menu */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {rounds.map((r, idx) => (
                  <div
                    key={idx}
                    className={`h-3 w-3 rounded-full transition-all duration-300 ${
                      idx + 1 === parseInt(round)
                        ? `bg-gradient-to-r ${config.gradient} scale-125`
                        : idx + 1 < parseInt(round)
                          ? "bg-gray-400"
                          : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>

              {/* Menu Button */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="rounded-lg bg-white p-2.5 shadow-md transition-colors hover:bg-gray-50"
                >
                  <svg
                    className="h-5 w-5 text-gray-700"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showMenu && (
                  <div className="absolute right-0 z-20 mt-2 min-w-[200px] space-y-1 rounded-lg bg-white p-2 shadow-lg">
                    <button
                      onClick={() => {
                        router.push(`/workout-overview?sessionId=${sessionId}`);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-gray-700 transition-colors hover:bg-gray-100"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 9l6-6m0 0l6 6m-6-6v12a6 6 0 01-12 0v-3"
                        />
                      </svg>
                      Back to Overview
                    </button>

                    <button
                      onClick={() => {
                        const nextRound = parseInt(round) + 1;
                        if (nextRound <= rounds.length) {
                          router.push(
                            `/workout-live?sessionId=${sessionId}&round=${nextRound}`,
                          );
                          setShowMenu(false);
                        }
                      }}
                      disabled={parseInt(round) >= rounds.length}
                      className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left transition-colors ${
                        parseInt(round) < rounds.length
                          ? "text-gray-700 hover:bg-gray-100"
                          : "cursor-not-allowed text-gray-400"
                      }`}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                        />
                      </svg>
                      Next Round
                    </button>

                    <button
                      onClick={() => {
                        const prevRound = parseInt(round) - 1;
                        if (prevRound >= 1) {
                          router.push(
                            `/workout-live?sessionId=${sessionId}&round=${prevRound}`,
                          );
                          setShowMenu(false);
                        }
                      }}
                      disabled={parseInt(round) <= 1}
                      className={`flex w-full items-center gap-2 rounded-md px-4 py-2 text-left transition-colors ${
                        parseInt(round) > 1
                          ? "text-gray-700 hover:bg-gray-100"
                          : "cursor-not-allowed text-gray-400"
                      }`}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                        />
                      </svg>
                      Previous Round
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Timer Section */}
          <div className="lg:col-span-1">
            <Timer
              timeLeft={timeLeft}
              phase={currentPhase}
              scheme={stations[0]?.scheme}
            />

            {/* Navigation */}
            <div className="mt-6 space-y-3">
              <button
                onClick={() => {
                  if (parseInt(round) <= 1) {
                    window.location.href = `/workout-overview?sessionId=${sessionId}`;
                  } else {
                    window.location.href = `/workout-live?sessionId=${sessionId}&round=${parseInt(round) - 1}`;
                  }
                }}
                className="w-full rounded-xl bg-white px-4 py-3 font-medium text-gray-700 shadow-md transition-colors hover:bg-gray-50"
              >
                {parseInt(round) <= 1
                  ? "← Back to Overview"
                  : "← Previous Round"}
              </button>

              {parseInt(round) < rounds.length && (
                <button
                  onClick={() => {
                    window.location.href = `/workout-live?sessionId=${sessionId}&round=${parseInt(round) + 1}`;
                  }}
                  className={`w-full bg-gradient-to-r px-4 py-3 ${config.gradient} rounded-xl font-medium text-white transition-all hover:shadow-lg`}
                >
                  Next Round →
                </button>
              )}
            </div>
          </div>

          {/* Exercise Stations */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {stations.map((station, idx) => (
                <ExerciseStation
                  key={idx}
                  index={idx}
                  participants={station.participants.map((p) => ({
                    name: p.userName,
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.userName)}`,
                  }))}
                  exercise={station.exerciseName}
                  phase={station.phase}
                  scheme={station.scheme}
                  isShared={station.isShared}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkoutLivePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <WorkoutLivePageContent />
    </Suspense>
  );
}
