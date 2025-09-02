"use client";

import { useState } from "react";
import { Button, Loader2Icon as Loader2 } from "@acme/ui-shared";
import { cn } from "@acme/ui-shared";
import type { CircuitConfig } from "@acme/db";

interface RoundsStepProps {
  rounds: number;
  repeatRounds: boolean;
  onRoundsChange: (rounds: number) => void;
  onRepeatToggle: (repeat: boolean) => void;
  isSaving: boolean;
}

export function RoundsStep({
  rounds,
  repeatRounds,
  onRoundsChange,
  onRepeatToggle,
  isSaving,
}: RoundsStepProps) {
  const roundOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const totalRounds = repeatRounds ? rounds * 2 : rounds;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">How many rounds?</h3>
        <p className="text-sm text-muted-foreground mb-4">Each round contains all exercises</p>
        <div className="grid grid-cols-5 gap-2">
          {roundOptions.map((option) => (
            <Button
              key={option}
              variant={rounds === option ? "primary" : "outline"}
              className="relative h-14 min-w-0 touch-manipulation text-base"
              onClick={() => onRoundsChange(option)}
              disabled={isSaving}
            >
              {isSaving && rounds === option && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {option}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
        <div className="space-y-0.5">
          <label htmlFor="repeat-rounds" className="text-base font-medium">
            Repeat rounds
          </label>
          <p className="text-sm text-muted-foreground">
            Double the workout intensity
          </p>
        </div>
        <button
          id="repeat-rounds"
          role="switch"
          aria-checked={repeatRounds}
          onClick={() => onRepeatToggle(!repeatRounds)}
          onTouchEnd={(e) => {
            e.preventDefault();
            if (!isSaving) onRepeatToggle(!repeatRounds);
          }}
          disabled={isSaving}
          className={cn(
            "relative inline-flex h-8 w-14 items-center rounded-full transition-colors touch-manipulation",
            repeatRounds ? "bg-primary" : "bg-gray-200",
            isSaving && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className={cn(
            "inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-sm",
            repeatRounds ? "translate-x-7" : "translate-x-1"
          )} />
        </button>
      </div>

      <div className="rounded-xl bg-primary/10 p-6 text-center">
        <p className="text-sm text-muted-foreground mb-1">Total rounds</p>
        <p className="text-3xl font-bold text-primary">{totalRounds}</p>
        {repeatRounds && (
          <p className="text-xs text-muted-foreground mt-1">({rounds} × 2)</p>
        )}
      </div>
    </div>
  );
}

interface ExercisesStepProps {
  exercises: number;
  onExercisesChange: (exercises: number) => void;
  isSaving: boolean;
}

export function ExercisesStep({
  exercises,
  onExercisesChange,
  isSaving,
}: ExercisesStepProps) {
  const presetOptions = [2, 3, 4, 5, 6, 7];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">
          Exercises per round
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          How many exercises in each round?
        </p>
        <div className="grid grid-cols-3 gap-2">
          {presetOptions.map((option) => (
            <Button
              key={option}
              variant={exercises === option ? "primary" : "outline"}
              className="relative h-14 min-w-0 touch-manipulation text-base"
              onClick={() => onExercisesChange(option)}
              disabled={isSaving}
            >
              {isSaving && exercises === option && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {option}
            </Button>
          ))}
        </div>
      </div>

    </div>
  );
}

interface TimingStepProps {
  workDuration: number;
  restDuration: number;
  restBetweenRounds: number;
  onWorkChange: (duration: number) => void;
  onRestChange: (duration: number) => void;
  onRoundRestChange: (duration: number) => void;
  isSaving: boolean;
}

export function TimingStep({
  workDuration,
  restDuration,
  restBetweenRounds,
  onWorkChange,
  onRestChange,
  onRoundRestChange,
  isSaving,
}: TimingStepProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <TimingOption
          label="Work"
          description="Time for each exercise"
          value={workDuration}
          options={[20, 30, 40, 45, 60]}
          onChange={onWorkChange}
          isSaving={isSaving}
          color="primary"
        />

        <TimingOption
          label="Rest"
          description="Between exercises"
          value={restDuration}
          options={[10, 15, 20, 30]}
          onChange={onRestChange}
          isSaving={isSaving}
          color="secondary"
        />

        <TimingOption
          label="Round Break"
          description="Between rounds"
          value={restBetweenRounds}
          options={[60, 90, 120]}
          onChange={onRoundRestChange}
          isSaving={isSaving}
          color="accent"
        />
      </div>
    </div>
  );
}

interface TimingOptionProps {
  label: string;
  description: string;
  value: number;
  options: number[];
  onChange: (value: number) => void;
  isSaving: boolean;
  color?: "primary" | "secondary" | "accent";
}

function TimingOption({
  label,
  description,
  value,
  options,
  onChange,
  isSaving,
  color = "primary",
}: TimingOptionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <h4 className="text-base font-semibold">{label}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className={cn(
          "text-2xl font-bold",
          color === "primary" && "text-primary",
          color === "secondary" && "text-blue-600",
          color === "accent" && "text-green-600"
        )}>
          {value}s
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {options.map((option) => (
          <Button
            key={option}
            variant={value === option ? "primary" : "outline"}
            className={cn(
              "relative h-12 min-w-0 touch-manipulation text-sm font-medium transition-all",
              value === option && color === "primary" && "bg-primary text-primary-foreground",
              value === option && color === "secondary" && "bg-blue-600 text-white hover:bg-blue-700",
              value === option && color === "accent" && "bg-green-600 text-white hover:bg-green-700"
            )}
            onClick={() => onChange(option)}
            disabled={isSaving}
          >
            {isSaving && value === option ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `${option}s`
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}

interface ReviewStepProps {
  config: CircuitConfig;
  repeatRounds: boolean;
}

export function ReviewStep({ config, repeatRounds }: ReviewStepProps) {
  const totalRounds = repeatRounds ? config.config.rounds * 2 : config.config.rounds;
  const totalExercises = totalRounds * config.config.exercisesPerRound;
  const totalWorkTime = totalExercises * config.config.workDuration;
  const totalRestTime = 
    (totalExercises - totalRounds) * config.config.restDuration + 
    (totalRounds - 1) * config.config.restBetweenRounds;
  const totalTime = totalWorkTime + totalRestTime;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-primary/10 p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Time</p>
          <p className="text-2xl font-bold text-primary">{formatTime(totalTime)}</p>
        </div>
        <div className="rounded-xl bg-green-500/10 p-4 text-center">
          <p className="text-sm text-muted-foreground">Total Exercises</p>
          <p className="text-2xl font-bold text-green-600">{totalExercises}</p>
        </div>
      </div>

      {/* Configuration Details */}
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3">Configuration Summary</h4>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm">Rounds</span>
            <span className="font-semibold">
              {config.config.rounds}
              {repeatRounds && ` × 2 = ${totalRounds}`}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm">Exercises per round</span>
            <span className="font-semibold">{config.config.exercisesPerRound}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm">Work / Rest / Round Break</span>
            <span className="font-semibold">
              {config.config.workDuration}s / {config.config.restDuration}s / {config.config.restBetweenRounds}s
            </span>
          </div>
        </div>
      </div>

      {/* Ready Message */}
      <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-center">
        <p className="text-sm text-green-700 font-medium">
          ✓ Configuration complete! Tap confirm to continue.
        </p>
      </div>
    </div>
  );
}