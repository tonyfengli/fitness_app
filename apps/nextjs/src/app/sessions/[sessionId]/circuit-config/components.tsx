"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button, Loader2Icon as Loader2 } from "@acme/ui-shared";
import { cn } from "@acme/ui-shared";
import type { CircuitConfig, RoundConfig } from "@acme/db";
import { useTRPC } from "~/trpc/react";

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

interface RoundTypesStepProps {
  rounds: number;
  roundTemplates: RoundConfig[];
  onRoundTemplatesChange: (roundTemplates: RoundConfig[]) => void;
  isSaving: boolean;
}

export function RoundTypesStep({
  rounds,
  roundTemplates,
  onRoundTemplatesChange,
  isSaving,
}: RoundTypesStepProps) {
  // Ensure we have the correct number of round templates
  const ensuredRoundTemplates = Array.from({ length: rounds }, (_, i) => {
    const existing = roundTemplates.find(rt => rt.roundNumber === i + 1);
    if (existing) return existing;
    
    // Default to circuit_round
    return {
      roundNumber: i + 1,
      template: {
        type: 'circuit_round' as const,
        exercisesPerRound: 6,
        workDuration: 45,
        restDuration: 15,
      }
    };
  });

  const handleRoundTypeChange = (roundNumber: number, type: 'circuit_round' | 'stations_round' | 'amrap_round' | 'warmup_cooldown_round') => {
    const newRoundTemplates = ensuredRoundTemplates.map(rt => {
      if (rt.roundNumber === roundNumber) {
        return {
          ...rt,
          template: {
            type,
            exercisesPerRound: rt.template.exercisesPerRound,
            // For circuit_round, amrap_round, and warmup_cooldown_round, include work and rest durations
            ...((type === 'circuit_round' || type === 'amrap_round' || type === 'warmup_cooldown_round') ? {
              workDuration: (rt.template as any).workDuration || 45,
              restDuration: (rt.template as any).restDuration || 15,
            } : {}),
            // For warmup_cooldown_round, default to warmup position
            ...(type === 'warmup_cooldown_round' ? {
              position: (rt.template as any).position || 'warmup'
            } : {})
          }
        };
      }
      return rt;
    });
    
    onRoundTemplatesChange(newRoundTemplates);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Round Types</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose the type for each round
        </p>
      </div>

      <div className="space-y-3">
        {ensuredRoundTemplates.map((roundConfig) => (
          <div 
            key={roundConfig.roundNumber}
            className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
          >
            <span className="text-base font-medium">
              Round {roundConfig.roundNumber}
            </span>
            
            <select
              value={roundConfig.template.type}
              onChange={(e) => handleRoundTypeChange(roundConfig.roundNumber, e.target.value as any)}
              disabled={isSaving}
              className={cn(
                "px-3 py-2 rounded-md border bg-background text-sm font-medium",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
                isSaving && "opacity-50 cursor-not-allowed"
              )}
            >
              <option value="circuit_round">Circuit</option>
              <option value="stations_round">Stations</option>
              <option value="amrap_round">AMRAP</option>
              <option value="warmup_cooldown_round">Warm-up/Cool-down</option>
            </select>
            
            {roundConfig.template.type === 'warmup_cooldown_round' && (
              <select
                value={(roundConfig.template as any).position || 'warmup'}
                onChange={(e) => {
                  const newRoundTemplates = ensuredRoundTemplates.map(rt => {
                    if (rt.roundNumber === roundConfig.roundNumber) {
                      return {
                        ...rt,
                        template: {
                          ...rt.template,
                          position: e.target.value as 'warmup' | 'cooldown'
                        }
                      };
                    }
                    return rt;
                  });
                  onRoundTemplatesChange(newRoundTemplates);
                }}
                disabled={isSaving}
                className={cn(
                  "ml-2 px-3 py-2 rounded-md border bg-background text-sm font-medium",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
                  isSaving && "opacity-50 cursor-not-allowed"
                )}
              >
                <option value="warmup">Warm-up</option>
                <option value="cooldown">Cool-down</option>
              </select>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 rounded-lg bg-primary/10">
        <p className="text-sm text-muted-foreground">
          <strong>Circuit:</strong> Traditional work/rest intervals
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          <strong>Stations:</strong> Work at each station
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          <strong>AMRAP:</strong> As Many Rounds As Possible
        </p>
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
        
        {/* Round Types */}
        {config.config.roundTemplates && config.config.roundTemplates.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">Round Types</h4>
            <div className="space-y-2">
              {config.config.roundTemplates.map((rt) => (
                <div key={rt.roundNumber} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                  <span>Round {rt.roundNumber}</span>
                  <span className="font-medium">
                    {rt.template.type === 'circuit_round' && 'Circuit'}
                    {rt.template.type === 'stations_round' && 'Stations'}
                    {rt.template.type === 'amrap_round' && 'AMRAP'}
                    {rt.template.type === 'warmup_cooldown_round' && 
                      `${(rt.template as any).position === 'cooldown' ? 'Cool-down' : 'Warm-up'}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
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

interface SpotifyStepProps {
  deviceId: string | null;
  deviceName: string | null;
  onDeviceSelect: (deviceId: string | null, deviceName: string | null) => void | Promise<void>;
}

export function SpotifyStep({ deviceId, deviceName, onDeviceSelect }: SpotifyStepProps) {
  const [devices, setDevices] = useState<Array<{ id: string; name: string; type: string; is_active: boolean }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const trpc = useTRPC();
  
  // Use TRPC query for devices (public endpoint)
  const devicesQuery = useQuery({
    ...trpc.spotify.getDevicesPublic.queryOptions(),
    enabled: false, // Manual trigger
  });

  const loadDevices = async () => {
    setError(null);
    const result = await devicesQuery.refetch();
    
    if (result.error) {
      setError('Failed to connect to Spotify. Please try again.');
    } else if (result.data) {
      if (result.data.devices.length === 0) {
        setError('No Spotify devices found. Make sure Spotify is running on your device.');
      } else {
        setDevices(result.data.devices);
        setError(null);
      }
    }
  };

  const handleDisconnect = async () => {
    setIsSaving(true);
    try {
      await onDeviceSelect(null, null);
      setDevices([]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Music Setup</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Connect Spotify to sync music with your workout
        </p>
      </div>

      {!deviceId ? (
        <>
          {/* Not Connected State */}
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/50 p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
              </div>
              <div>
                <p className="font-medium">Spotify not connected</p>
                <p className="text-sm text-muted-foreground">
                  Music will enhance your workout experience
                </p>
              </div>
            </div>

            <Button
              onClick={loadDevices}
              disabled={devicesQuery.isLoading}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white"
            >
              {devicesQuery.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finding devices...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Connect Spotify
                </>
              )}
            </Button>

            {/* Device List */}
            {!devicesQuery.isLoading && devices.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Select a device:</p>
                {devices.map((device) => (
                  <button
                    key={device.id}
                    onClick={async () => {
                      console.log('[SpotifyStep] Device selected:', { id: device.id, name: device.name });
                      setIsSaving(true);
                      try {
                        await onDeviceSelect(device.id, device.name);
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={isSaving}
                    className="w-full p-4 rounded-lg border bg-background hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{device.name}</p>
                        <p className="text-sm text-muted-foreground">{device.type}</p>
                      </div>
                      {device.is_active && (
                        <div className="flex items-center text-green-600">
                          <div className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse" />
                          <span className="text-sm">Active</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Skip Option */}
            <div className="text-center pt-2">
              <button
                onClick={() => onDeviceSelect(null, null)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Continue without music →
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Connected State */}
          <div className="space-y-4">
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-green-700 font-medium">Connected to</p>
                    <p className="font-semibold text-lg">{deviceName}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isSaving}
                  className="text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    'Disconnect'
                  )}
                </Button>
              </div>
            </div>


            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Note:</span> Music will start automatically when the workout begins. 
                The TV will control playback timing to sync with exercise intervals.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}