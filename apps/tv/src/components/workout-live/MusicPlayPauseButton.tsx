import React from 'react';
import { Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { TOKENS } from './types';
import { MattePanel } from './MattePanel';
import { createPhaseKey, serializeKey } from '../../music';

interface MusicPlayPauseButtonProps {
  // XState
  send: (event: { type: string; enabled?: boolean; phaseKey?: string }) => void;
  workoutStateValue: string; // 'roundPreview' | 'exercise' | 'rest' | 'setBreak' | etc.
  currentRoundIndex: number;
  currentExerciseIndex: number;
  currentSetNumber: number;

  // MusicProvider state
  isMusicPlaying: boolean;
  isMusicPaused: boolean;
  currentTrack: any | null;

  // MusicProvider actions
  pauseMusic: () => void;
  playOrResume: () => Promise<void>;

  // UI props
  focusable?: boolean;
  isStationsExercise?: boolean; // For orange theming in stations exercise state
}

/**
 * Unified Music Play/Pause Button
 *
 * Handles XState sync for musicEnabled and musicStartedFromPreview:
 * - In Preview: SET_MUSIC_ENABLED → musicStartedFromPreview: true (countdowns allowed)
 * - Mid-workout: ENABLE_MUSIC_AND_CONSUME → musicStartedFromPreview: false (no countdowns)
 */
export function MusicPlayPauseButton({
  send,
  workoutStateValue,
  currentRoundIndex,
  currentExerciseIndex,
  currentSetNumber,
  isMusicPlaying,
  isMusicPaused,
  currentTrack,
  pauseMusic,
  playOrResume,
  focusable = true,
  isStationsExercise = false,
}: MusicPlayPauseButtonProps) {
  const handlePress = () => {
    if (isMusicPlaying) {
      // PAUSE: Disable music triggers and pause audio
      send({ type: 'SET_MUSIC_ENABLED', enabled: false });
      pauseMusic();
    } else {
      // PLAY: Enable music and start/resume audio
      const isPreview = workoutStateValue === 'roundPreview';

      if (isPreview) {
        // From preview: musicStartedFromPreview = true (countdowns allowed)
        send({ type: 'SET_MUSIC_ENABLED', enabled: true });
      } else {
        // Mid-workout: musicStartedFromPreview = false (no countdowns)
        // Also consume current phase to prevent trigger evaluation from firing
        const phaseType = workoutStateValue === 'exercise' ? 'exercise' :
                         workoutStateValue === 'rest' ? 'rest' :
                         workoutStateValue === 'setBreak' ? 'setBreak' : null;

        if (phaseType) {
          const phaseIndex = (phaseType === 'exercise' || phaseType === 'rest')
            ? currentExerciseIndex
            : (phaseType === 'setBreak' ? currentSetNumber - 1 : 0);
          const phase = createPhaseKey(
            phaseType as any,
            currentRoundIndex,
            phaseIndex,
            currentSetNumber
          );
          send({ type: 'ENABLE_MUSIC_AND_CONSUME', phaseKey: serializeKey(phase) });
        } else {
          // Fallback: just enable (shouldn't happen in normal flow)
          send({ type: 'SET_MUSIC_ENABLED', enabled: true });
        }
      }

      playOrResume();
    }
  };

  return (
    <Pressable onPress={handlePress} focusable={focusable}>
      {({ focused }) => (
        <MattePanel
          focused={focused}
          radius={22}
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isMusicPlaying
              ? (focused ? 'rgba(93,225,255,0.25)' : 'rgba(93,225,255,0.12)')
              : (focused
                  ? (isStationsExercise ? 'rgba(255,179,102,0.2)' : 'rgba(255,255,255,0.15)')
                  : (isStationsExercise ? 'rgba(255,179,102,0.1)' : 'rgba(255,255,255,0.06)')),
            borderColor: isMusicPlaying
              ? TOKENS.color.accent2
              : (focused
                  ? (isStationsExercise ? 'rgba(255,179,102,0.4)' : 'rgba(255,255,255,0.25)')
                  : 'transparent'),
            borderWidth: isMusicPlaying ? 1.5 : (focused ? 1 : 0),
          }}
        >
          <Icon
            name={isMusicPlaying ? 'music-note' : 'music-off'}
            size={20}
            color={isMusicPlaying
              ? TOKENS.color.accent2
              : (isStationsExercise ? '#fff5e6' : TOKENS.color.text)}
          />
        </MattePanel>
      )}
    </Pressable>
  );
}
