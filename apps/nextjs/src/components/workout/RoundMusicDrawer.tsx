"use client";

import React from "react";
import { api } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface RoundMusicDrawerProps {
  sessionId?: string | null;
  roundNumber: number;
  roundType?: string;
  onClose?: () => void;
}

interface MusicTrigger {
  enabled: boolean;
  trackId?: string;
  useStartTimestamp?: boolean;
  energy?: 'high' | 'low';
}

interface RoundMusicConfig {
  roundPreview?: MusicTrigger;
  exercises?: MusicTrigger[];
  rests?: MusicTrigger[];
  setBreaks?: MusicTrigger[];
}

export function RoundMusicDrawer({
  sessionId,
  roundNumber,
  roundType,
  onClose,
}: RoundMusicDrawerProps) {
  const trpc = api();
  const queryClient = useQueryClient();

  const { data: circuitConfig, isLoading } = useQuery({
    ...trpc.circuitConfig.getBySession.queryOptions({ sessionId: sessionId! }),
    enabled: !!sessionId,
  });

  // Local state for editing
  const [localConfig, setLocalConfig] = React.useState<RoundMusicConfig | null>(null);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Extract music config for this round
  const serverMusicConfig: RoundMusicConfig | null = React.useMemo(() => {
    if (!circuitConfig?.config?.roundTemplates) return null;
    const roundTemplate = (circuitConfig.config.roundTemplates as any[]).find(
      (rt) => rt.roundNumber === roundNumber
    );
    return roundTemplate?.music ?? null;
  }, [circuitConfig, roundNumber]);

  // Initialize local config from server
  React.useEffect(() => {
    if (serverMusicConfig && !localConfig) {
      setLocalConfig(JSON.parse(JSON.stringify(serverMusicConfig)));
    }
  }, [serverMusicConfig, localConfig]);

  // Save mutation
  const updateMusicConfig = useMutation({
    ...trpc.circuitConfig.updateRoundMusicConfig.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: trpc.circuitConfig.getBySession.queryOptions({ sessionId: sessionId! }).queryKey,
      });
      setHasChanges(false);
    },
  });

  const musicConfig = localConfig || serverMusicConfig;

  // Update handlers
  const updateTrigger = (
    phase: 'roundPreview' | 'exercises' | 'rests' | 'setBreaks',
    index: number | null,
    updates: Partial<MusicTrigger>
  ) => {
    if (!localConfig) return;

    const newConfig = { ...localConfig };

    if (phase === 'roundPreview') {
      newConfig.roundPreview = { ...newConfig.roundPreview!, ...updates };
    } else {
      const arr = [...(newConfig[phase] || [])];
      if (index !== null && arr[index]) {
        arr[index] = { ...arr[index], ...updates };
        newConfig[phase] = arr;
      }
    }

    setLocalConfig(newConfig);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!sessionId || !localConfig) return;
    await updateMusicConfig.mutateAsync({
      sessionId,
      roundNumber,
      musicConfig: localConfig,
    });
    onClose?.();
  };

  // Toggle button component
  const ToggleButton = ({
    enabled,
    onToggle,
  }: {
    enabled: boolean;
    onToggle: () => void;
  }) => (
    <button
      onClick={onToggle}
      className={`
        relative w-10 h-6 rounded-full transition-colors
        ${enabled
          ? 'bg-purple-500'
          : 'bg-gray-200 dark:bg-gray-700'
        }
      `}
    >
      <div
        className={`
          absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
          ${enabled ? 'translate-x-5' : 'translate-x-1'}
        `}
      />
    </button>
  );

  // Energy selector component
  const EnergySelector = ({
    energy,
    enabled,
    onChange,
  }: {
    energy: 'high' | 'low';
    enabled: boolean;
    onChange: (e: 'high' | 'low') => void;
  }) => (
    <div className={`flex gap-1 ${!enabled ? 'opacity-40' : ''}`}>
      <button
        disabled={!enabled}
        onClick={() => onChange('low')}
        className={`
          px-2.5 py-1 rounded-l-lg text-xs font-medium transition-all
          ${energy === 'low'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
          }
        `}
      >
        Low
      </button>
      <button
        disabled={!enabled}
        onClick={() => onChange('high')}
        className={`
          px-2.5 py-1 rounded-r-lg text-xs font-medium transition-all
          ${energy === 'high'
            ? 'bg-orange-500 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
          }
        `}
      >
        High
      </button>
    </div>
  );

  // Drop toggle component
  const DropToggle = ({
    useStartTimestamp,
    enabled,
    onToggle,
  }: {
    useStartTimestamp: boolean;
    enabled: boolean;
    onToggle: () => void;
  }) => (
    <button
      disabled={!enabled}
      onClick={onToggle}
      className={`
        px-2.5 py-1 rounded-lg text-xs font-medium transition-all
        ${!enabled ? 'opacity-40' : ''}
        ${useStartTimestamp
          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
        }
      `}
    >
      Drop
    </button>
  );

  // Phase row component
  const PhaseRow = ({
    label,
    trigger,
    phase,
    index,
  }: {
    label: string;
    trigger: MusicTrigger | undefined;
    phase: 'roundPreview' | 'exercises' | 'rests' | 'setBreaks';
    index: number | null;
  }) => {
    if (!trigger) return null;

    return (
      <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
        <div className="flex items-center gap-3">
          <ToggleButton
            enabled={trigger.enabled}
            onToggle={() => updateTrigger(phase, index, { enabled: !trigger.enabled })}
          />
          <span className={`text-sm ${trigger.enabled ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <EnergySelector
            energy={trigger.energy || 'high'}
            enabled={trigger.enabled}
            onChange={(e) => updateTrigger(phase, index, { energy: e })}
          />
          <DropToggle
            useStartTimestamp={trigger.useStartTimestamp || false}
            enabled={trigger.enabled}
            onToggle={() => updateTrigger(phase, index, { useStartTimestamp: !trigger.useStartTimestamp })}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
          </div>
        ) : !musicConfig ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            No music configured
          </div>
        ) : (
          <div className="space-y-6">
            {/* Preview Section */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Preview
              </h4>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4">
                <PhaseRow
                  label="Round Preview"
                  trigger={musicConfig.roundPreview}
                  phase="roundPreview"
                  index={null}
                />
              </div>
            </div>

            {/* Exercises Section */}
            {musicConfig.exercises && musicConfig.exercises.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Exercises
                </h4>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4">
                  {musicConfig.exercises.map((trigger, i) => (
                    <PhaseRow
                      key={i}
                      label={`Exercise ${i + 1}`}
                      trigger={trigger}
                      phase="exercises"
                      index={i}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Rests Section */}
            {roundType !== 'amrap_round' && musicConfig.rests && musicConfig.rests.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Rests
                </h4>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4">
                  {musicConfig.rests.map((trigger, i) => (
                    <PhaseRow
                      key={i}
                      label={`Rest ${i + 1}`}
                      trigger={trigger}
                      phase="rests"
                      index={i}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Set Breaks Section */}
            {musicConfig.setBreaks && musicConfig.setBreaks.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Set Breaks
                </h4>
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4">
                  {musicConfig.setBreaks.map((trigger, i) => (
                    <PhaseRow
                      key={i}
                      label={`Break ${i + 1}`}
                      trigger={trigger}
                      phase="setBreaks"
                      index={i}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateMusicConfig.isPending}
            className={`
              flex-1 px-4 py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2
              ${hasChanges && !updateMusicConfig.isPending
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {updateMusicConfig.isPending && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            )}
            {updateMusicConfig.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
