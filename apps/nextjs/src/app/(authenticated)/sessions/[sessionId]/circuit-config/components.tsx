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
        <label className="text-base font-medium">Select number of rounds</label>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {roundOptions.map((option) => (
            <Button
              key={option}
              variant={rounds === option ? "primary" : "outline"}
              className="relative h-12"
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

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <label htmlFor="repeat-rounds" className="text-base">
            Repeat rounds
          </label>
          <p className="text-sm text-muted-foreground">
            Double the workout by repeating all rounds
          </p>
        </div>
        <button
          id="repeat-rounds"
          role="switch"
          aria-checked={repeatRounds}
          onClick={() => onRepeatToggle(!repeatRounds)}
          disabled={isSaving}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            repeatRounds ? "bg-primary" : "bg-gray-200",
            isSaving && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            repeatRounds ? "translate-x-6" : "translate-x-1"
          )} />
        </button>
      </div>

      <div className="rounded-lg bg-muted p-4 text-center">
        <p className="text-sm text-muted-foreground">Total rounds</p>
        <p className="text-2xl font-bold">{totalRounds}</p>
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
        <label className="text-base font-medium">
          Select exercises per round
        </label>
        <p className="mt-1 text-sm text-muted-foreground">
          Common options for quick selection
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {presetOptions.map((option) => (
            <Button
              key={option}
              variant={exercises === option ? "primary" : "outline"}
              className="relative h-12"
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
    <div className="space-y-6">
      <TimingOption
        label="Exercise Duration"
        description="Time for each exercise"
        value={workDuration}
        options={[10, 20, 30, 40, 45, 60, 90]}
        onChange={onWorkChange}
        isSaving={isSaving}
      />

      <TimingOption
        label="Rest Duration"
        description="Rest between exercises"
        value={restDuration}
        options={[5, 10, 15, 20, 30, 45]}
        onChange={onRestChange}
        isSaving={isSaving}
      />

      <TimingOption
        label="Rest Between Rounds"
        description="Rest after completing a round"
        value={restBetweenRounds}
        options={[30, 45, 60, 90, 120, 180]}
        onChange={onRoundRestChange}
        isSaving={isSaving}
      />
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
}

function TimingOption({
  label,
  description,
  value,
  options,
  onChange,
  isSaving,
}: TimingOptionProps) {
  return (
    <div>
      <label className="text-base font-medium">{label}</label>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {options.map((option) => (
          <Button
            key={option}
            variant={value === option ? "primary" : "outline"}
            className="relative h-12"
            onClick={() => onChange(option)}
            disabled={isSaving}
          >
            {isSaving && value === option && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {option}s
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
      <div className="space-y-4">
        <div className="flex justify-between border-b pb-2">
          <span className="text-muted-foreground">Rounds</span>
          <span className="font-medium">
            {config.config.rounds}
            {repeatRounds && ` × 2 = ${totalRounds}`}
          </span>
        </div>

        <div className="flex justify-between border-b pb-2">
          <span className="text-muted-foreground">Exercises per round</span>
          <span className="font-medium">{config.config.exercisesPerRound}</span>
        </div>

        <div className="flex justify-between border-b pb-2">
          <span className="text-muted-foreground">Exercise duration</span>
          <span className="font-medium">{config.config.workDuration} seconds</span>
        </div>

        <div className="flex justify-between border-b pb-2">
          <span className="text-muted-foreground">Rest duration</span>
          <span className="font-medium">{config.config.restDuration} seconds</span>
        </div>

        <div className="flex justify-between border-b pb-2">
          <span className="text-muted-foreground">Rest between rounds</span>
          <span className="font-medium">{config.config.restBetweenRounds} seconds</span>
        </div>

        <div className="flex justify-between border-b pb-2">
          <span className="text-muted-foreground">Total workout time</span>
          <span className="font-medium text-lg">{formatTime(totalTime)}</span>
        </div>
      </div>
    </div>
  );
}