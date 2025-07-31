"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

// Exercise station component
function ExerciseStation({
  participants,
  exercise,
  icon,
  currentSet,
  totalSets,
  color,
  progressWithinSet,
  isComplete,
}: {
  participants: { name: string; avatar: string }[];
  exercise: string;
  icon: React.ReactNode;
  currentSet: number;
  totalSets: number;
  color: string;
  progressWithinSet: number;
  isComplete: boolean;
}) {
  const borderColors = {
    green: "border-green-500",
    blue: "border-blue-500",
    orange: "border-orange-500",
  };

  const progressColors = {
    green: "bg-green-500",
    blue: "bg-blue-500",
    orange: "bg-orange-500",
  };

  // Use the dynamic progress passed from parent
  const progress = progressWithinSet;

  return (
    <div className="flex flex-col items-center">
      {/* Participants */}
      <div className="flex items-center gap-2 mb-4">
        {participants.map((participant, idx) => (
          <img
            key={idx}
            src={participant.avatar}
            alt={participant.name}
            className="w-12 h-12 rounded-full"
          />
        ))}
      </div>
      
      {/* Names */}
      <div className="flex items-center justify-center gap-4 mb-4 h-16">
        {participants.length <= 3 ? (
          // For 1-3 participants, stack vertically
          <div className="flex flex-col items-center justify-center gap-1">
            {participants.map((p, idx) => (
              <h3 key={idx} className="text-xl font-semibold text-gray-800">
                {p.name}
              </h3>
            ))}
          </div>
        ) : participants.length === 4 ? (
          // For 4 participants, 2 groups side by side
          <>
            <div className="flex flex-col items-center gap-1">
              {participants.slice(0, 2).map((p, idx) => (
                <h3 key={idx} className="text-lg font-semibold text-gray-800">
                  {p.name}
                </h3>
              ))}
            </div>
            <div className="flex flex-col items-center gap-1">
              {participants.slice(2, 4).map((p, idx) => (
                <h3 key={idx + 2} className="text-lg font-semibold text-gray-800">
                  {p.name}
                </h3>
              ))}
            </div>
          </>
        ) : (
          // For 5+ participants, groups of 2 with max 4 side by side
          <div className="flex gap-3">
            {Array.from({ length: Math.ceil(participants.length / 2) }, (_, groupIdx) => {
              const startIdx = groupIdx * 2;
              const group = participants.slice(startIdx, startIdx + 2);
              return (
                <div key={groupIdx} className="flex flex-col items-center gap-0.5">
                  {group.map((p, idx) => (
                    <h3 key={startIdx + idx} className="text-sm font-semibold text-gray-800">
                      {p.name}
                    </h3>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Exercise Card */}
      <div className={`bg-white rounded-2xl border-4 ${borderColors[color as keyof typeof borderColors]} p-8 w-80 h-80 shadow-sm flex flex-col ${isComplete ? 'opacity-75' : ''}`}>
        <h2 className="text-3xl font-bold text-center mb-8 break-words" style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minHeight: '2.4em',
          maxHeight: '2.4em',
          lineHeight: '1.2em'
        }}>{exercise}</h2>
        
        {/* Exercise Icon */}
        <div className="flex justify-center flex-1 items-center">
          {icon}
        </div>

        {/* Progress Bar */}
        <div className="relative mt-auto pt-4">
          <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full ${progressColors[color as keyof typeof progressColors]} transition-all duration-300`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center mt-2 text-gray-600 font-medium">
            {isComplete ? '✓ Complete' : `Set ${currentSet}/${totalSets}`}
          </p>
        </div>
      </div>

    </div>
  );
}

// Timer component
function Timer({ timeLeft }: { timeLeft: number }) {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  // Change color when time is running low
  const timerColor = timeLeft <= 30 ? "text-red-600" : timeLeft <= 60 ? "text-orange-600" : "text-gray-900";
  const messageColor = timeLeft <= 30 ? "text-red-500" : timeLeft <= 60 ? "text-orange-500" : "text-gray-600";

  return (
    <div className="flex flex-col items-center">
      <div className={`text-9xl font-bold ${timerColor} tabular-nums leading-none tracking-tighter transition-colors duration-300`}>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>
      <div className={`text-xl ${messageColor} mt-3 font-medium uppercase tracking-wide transition-colors duration-300`}>
        {timeLeft > 180 ? "Keep Going!" : timeLeft > 60 ? "Halfway There!" : timeLeft > 30 ? "Final Minute!" : timeLeft > 0 ? "Almost Done!" : "Time's Up!"}
      </div>
    </div>
  );
}

export default function WorkoutLivePage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const round = searchParams.get("round") || "1";
  const [timeLeft, setTimeLeft] = useState(299); // Share timer state
  const trpc = useTRPC();

  // Fetch workouts for the session
  const { data: sessionWorkouts, isLoading } = useQuery({
    ...trpc.workout.sessionWorkoutsWithExercises.queryOptions({ 
      sessionId: sessionId || "" 
    }),
    enabled: !!sessionId,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Group exercises by name for the current round
  const groupedExercises = React.useMemo(() => {
    if (!sessionWorkouts) return [];

    // Create a map of exercise name to clients
    const exerciseMap = new Map<string, {
      exerciseName: string;
      participants: Array<{
        userId: string;
        userName: string;
        setsCompleted: number;
        totalSets: number;
      }>;
    }>();

    // Process each workout
    sessionWorkouts.forEach(workoutData => {
      // Filter exercises for the current round/block
      const roundExercises = workoutData.exercises.filter(ex => {
        const groupName = ex.groupName?.toLowerCase() || '';
        return groupName.includes(`round ${round}`) || 
               groupName.includes(`block ${round}`) ||
               groupName === `round${round}` ||
               groupName === `block ${String.fromCharCode(64 + parseInt(round))}`.toLowerCase(); // Block A, B, C, D
      });

      // Group by exercise name
      roundExercises.forEach(exercise => {
        const exerciseName = exercise.exercise.name;
        
        if (!exerciseMap.has(exerciseName)) {
          exerciseMap.set(exerciseName, {
            exerciseName,
            participants: []
          });
        }

        exerciseMap.get(exerciseName)!.participants.push({
          userId: workoutData.user.id,
          userName: workoutData.user.name || workoutData.user.email.split('@')[0],
          setsCompleted: exercise.setsCompleted,
          totalSets: exercise.setsCompleted // For now, using completed as total
        });
      });
    });

    // Convert map to array and sort by exercise name
    return Array.from(exerciseMap.values()).sort((a, b) => 
      a.exerciseName.localeCompare(b.exerciseName)
    );
  }, [sessionWorkouts, round]);

  // Calculate dynamic progress based on time
  const totalTime = 299; // 4:59 in seconds
  const timeElapsed = totalTime - timeLeft;
  const progressPercent = (timeElapsed / totalTime) * 100;

  // Dynamic set calculation for each station
  const getStationProgress = (stationIndex: number) => {
    // Each station progresses at different rates
    const rates = [0.6, 1.0, 0.5]; // Back Squat slower, Pull Ups normal, Bench Press slowest
    const rate = rates[stationIndex] || 1;
    
    const stationProgress = progressPercent * rate;
    const totalSets = stationIndex === 1 ? 5 : 3; // Pull Ups has 5 sets, others have 3
    
    // Calculate current set and progress within that set
    const setsCompleted = Math.floor((stationProgress / 100) * totalSets);
    const currentSet = Math.min(setsCompleted + 1, totalSets);
    const progressWithinSet = ((stationProgress / 100) * totalSets - setsCompleted) * 100;
    
    return {
      currentSet,
      progressWithinSet: currentSet >= totalSets ? 100 : progressWithinSet,
      isComplete: currentSet >= totalSets && progressWithinSet >= 100
    };
  };

  // Map exercise names to colors and icons
  const getExerciseStyle = (exerciseName: string, index: number) => {
    const colors = ["green", "blue", "orange", "purple", "red", "indigo"];
    const color = colors[index % colors.length];
    
    // Simple icon mapping based on exercise type
    let icon = null;
    const lowerName = exerciseName.toLowerCase();
    
    if (lowerName.includes("squat")) {
      icon = (
        <svg className={`w-24 h-24 text-${color}-600`} fill="currentColor" viewBox="0 0 100 100">
          <path d="M25 30 L25 70 M75 30 L75 70 M15 40 L85 40 M15 60 L85 60 M35 25 L35 35 M65 25 L65 35" 
                stroke="currentColor" strokeWidth="8" fill="none" strokeLinecap="round"/>
        </svg>
      );
    } else if (lowerName.includes("pull") || lowerName.includes("row")) {
      icon = (
        <svg className={`w-24 h-24 text-${color}-600`} fill="currentColor" viewBox="0 0 100 100">
          <circle cx="50" cy="25" r="8"/>
          <path d="M35 35 Q50 45 65 35 L65 55 Q50 65 35 55 Z"/>
          <path d="M40 30 L40 70 M60 30 L60 70" stroke="currentColor" strokeWidth="3" fill="none"/>
        </svg>
      );
    } else if (lowerName.includes("press") || lowerName.includes("bench")) {
      icon = (
        <svg className={`w-24 h-24 text-${color}-600`} fill="currentColor" viewBox="0 0 100 100">
          <rect x="10" y="45" width="80" height="10" rx="5"/>
          <rect x="45" y="20" width="10" height="60" rx="5"/>
          <circle cx="20" cy="50" r="8"/>
          <circle cx="80" cy="50" r="8"/>
        </svg>
      );
    } else {
      // Default icon for other exercises
      icon = (
        <svg className={`w-24 h-24 text-${color}-600`} fill="currentColor" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="6" fill="none"/>
          <path d="M50 30 L50 50 L65 65" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
        </svg>
      );
    }
    
    return { color, icon };
  };

  // Convert grouped exercises to station format
  const stations = groupedExercises.map((group, index) => {
    const { color, icon } = getExerciseStyle(group.exerciseName, index);
    
    return {
      participants: group.participants.map(p => ({
        name: p.userName,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.userName)}`
      })),
      exercise: group.exerciseName,
      icon,
      totalSets: group.participants[0]?.totalSets || 3, // Use first participant's total sets
      color
    };
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading workout data...</p>
        </div>
      </div>
    );
  }

  // No session ID
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No session selected</p>
        </div>
      </div>
    );
  }

  // No exercises for this round
  if (stations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">Round {round}</h1>
            <div className="mt-2 h-2 bg-blue-600 rounded-full" style={{ width: "100%" }} />
          </div>
          <Timer timeLeft={timeLeft} />
        </div>
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-600">No exercises found for Round {round}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-bold text-gray-800">Round {round}</h1>
          <div className="mt-2 h-2 bg-blue-600 rounded-full" style={{ width: "100%" }} />
        </div>
        <Timer timeLeft={timeLeft} />
      </div>

      {/* Exercise Stations */}
      <div className="flex justify-center gap-12 flex-wrap">
        {stations.map((station, idx) => {
          const progress = getStationProgress(idx);
          return (
            <ExerciseStation 
              key={idx} 
              {...station} 
              currentSet={progress.currentSet}
              progressWithinSet={progress.progressWithinSet}
              isComplete={progress.isComplete}
            />
          );
        })}
      </div>

      {/* Navigation */}
      <div className="mt-32 flex justify-between items-center">
        <button
          onClick={() => {
            if (parseInt(round) <= 1) {
              // Navigate back to workout overview for Round 1
              window.location.href = `/workout-overview?sessionId=${sessionId}`;
            } else {
              // Navigate to previous round
              const prevRound = parseInt(round) - 1;
              window.location.href = `/workout-live?sessionId=${sessionId}&round=${prevRound}`;
            }
          }}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {parseInt(round) <= 1 ? 'Back to Overview' : 'Previous Round'}
        </button>
        
        <div className="text-gray-600">
          Round {round} of {sessionWorkouts?.[0]?.exercises.reduce((max, ex) => {
            const roundNum = ex.groupName?.match(/\d+/)?.[0];
            return Math.max(max, parseInt(roundNum || '0'));
          }, 0) || 4}
        </div>
        
        <button
          onClick={() => {
            const nextRound = parseInt(round) + 1;
            window.location.href = `/workout-live?sessionId=${sessionId}&round=${nextRound}`;
          }}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Next Round
        </button>
      </div>
    </div>
  );
}