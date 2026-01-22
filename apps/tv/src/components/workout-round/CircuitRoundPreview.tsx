import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { TOKENS, MattePanel, CircuitExercise, RoundData } from './shared';
import { useNavigation } from '../../App';
import { useMusic } from '../../providers/MusicProvider';
import type { CircuitConfig } from '@acme/db';

interface CircuitRoundPreviewProps {
  currentRound: RoundData;
  repeatTimes?: number;
  timeRemaining?: number;
  isTimerActive?: boolean;
  roundNumber?: number;
  currentRoundIndex?: number;
  totalRounds?: number;
  roundDuration?: number;
  circuitConfig?: CircuitConfig;
  onStartExercise?: () => void; // Callback to start exercise (triggered when rise countdown completes)
}

export function CircuitRoundPreview({ currentRound, repeatTimes = 1, timeRemaining = 0, isTimerActive = false, roundNumber, currentRoundIndex = 0, circuitConfig, onStartExercise }: CircuitRoundPreviewProps) {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  const { tracks, preSelectedRiseTrack, preSelectRiseTrack, clearPreSelectedRiseTrack, buildupCountdown, playWithTrigger, addConsumedTrigger } = useMusic();

  // Track if rise transition has been started
  const [isRiseActive, setIsRiseActive] = useState(false);
  const hasTriggeredTransition = useRef(false);
  const hadCountdownActive = useRef(false);

  // Extract round number from round name if not provided
  const extractedRoundNumber = roundNumber || (() => {
    const match = currentRound.roundName?.match(/Round (\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  })();

  // Get music config for round 1
  const exercise1Trigger = useMemo(() => {
    if (currentRoundIndex !== 0) return null;
    const roundTemplates = circuitConfig?.config?.roundTemplates as any[] | undefined;
    const round1Config = roundTemplates?.find((rt) => rt.roundNumber === 1);
    return round1Config?.music?.exercises?.[0];
  }, [currentRoundIndex, circuitConfig]);

  // Pre-select rise track when entering round 1 preview with random buildup
  useEffect(() => {
    // Only for round 1
    if (currentRoundIndex !== 0) {
      clearPreSelectedRiseTrack();
      return;
    }

    // Check if exercise 1 has buildup enabled but no specific track
    if (exercise1Trigger?.enabled && exercise1Trigger?.useBuildup && !exercise1Trigger?.trackId) {
      const energy = exercise1Trigger.energy || 'medium';
      preSelectRiseTrack(energy);
    }

    // Cleanup when leaving round 1 preview
    return () => {
      // Don't clear immediately - let playWithTrigger use it
    };
  }, [currentRoundIndex, exercise1Trigger, preSelectRiseTrack, clearPreSelectedRiseTrack]);

  // Calculate rise info for round 1 only (exercise 1 with buildup)
  const riseInfo = useMemo(() => {
    if (currentRoundIndex !== 0) return null;
    if (!exercise1Trigger?.enabled || !exercise1Trigger?.useBuildup) return null;

    // Check for specific track first
    const trackId = exercise1Trigger.trackId;
    if (trackId) {
      const track = tracks.find(t => t.id === trackId);
      if (track) {
        const segments = track.segments || [];
        const mediumSegment = segments.find(s => s.energy === 'medium');
        const highSegment = segments.find(s => s.energy === 'high');

        if (mediumSegment && highSegment) {
          const riseDuration = highSegment.timestamp - mediumSegment.timestamp;
          return {
            trackName: track.name,
            riseDuration: Math.round(riseDuration * 10) / 10,
          };
        }
      }
    }

    // Use pre-selected track for random mode
    if (preSelectedRiseTrack) {
      return {
        trackName: preSelectedRiseTrack.track.name,
        riseDuration: preSelectedRiseTrack.riseDuration,
      };
    }

    return null;
  }, [currentRoundIndex, tracks, exercise1Trigger, preSelectedRiseTrack]);

  // Check if showRiseCountdown is enabled (defaults to true when useBuildup is true)
  const showRiseCountdown = exercise1Trigger?.showRiseCountdown ?? (exercise1Trigger?.useBuildup ?? false);

  // Handle starting the rise transition
  const handleStartRise = useCallback(async () => {
    console.log('[CircuitRoundPreview] handleStartRise called, riseInfo:', !!riseInfo, 'isRiseActive:', isRiseActive);
    if (!riseInfo || isRiseActive) return;

    setIsRiseActive(true);
    hasTriggeredTransition.current = false;
    hadCountdownActive.current = false;

    // Mark the exercise 1 trigger as "consumed" so it won't fire again when we enter exercise 1
    const exercisePhaseKey = `exercise-${currentRoundIndex}-0-1`;
    console.log('[CircuitRoundPreview] Adding consumed trigger:', exercisePhaseKey);
    addConsumedTrigger(exercisePhaseKey);

    const trackId = exercise1Trigger?.trackId || preSelectedRiseTrack?.track.id;
    const energy = exercise1Trigger?.energy || 'medium';

    console.log('[CircuitRoundPreview] Calling playWithTrigger for rise:', { energy, trackId, useBuildup: true });
    await playWithTrigger({
      energy: energy as 'low' | 'medium' | 'high',
      useBuildup: true,
      trackId,
    });
  }, [riseInfo, isRiseActive, exercise1Trigger, preSelectedRiseTrack, playWithTrigger, currentRoundIndex, addConsumedTrigger]);

  // Watch for countdown completion to trigger transition
  useEffect(() => {
    if (!isRiseActive) return;

    console.log('[CircuitRoundPreview] Countdown effect, buildupCountdown:', buildupCountdown, 'hadCountdownActive:', hadCountdownActive.current);

    if (buildupCountdown !== null && buildupCountdown > 0) {
      hadCountdownActive.current = true;
    }

    // Trigger transition when countdown was active and now completes
    if (hadCountdownActive.current && buildupCountdown === null && !hasTriggeredTransition.current) {
      console.log('[CircuitRoundPreview] Countdown complete, triggering transition in 100ms');
      const timer = setTimeout(() => {
        if (!hasTriggeredTransition.current) {
          hasTriggeredTransition.current = true;
          console.log('[CircuitRoundPreview] Calling onStartExercise');
          onStartExercise?.();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isRiseActive, buildupCountdown, onStartExercise]);

  // Reset rise state when leaving this preview (e.g., navigating away)
  useEffect(() => {
    return () => {
      setIsRiseActive(false);
      hasTriggeredTransition.current = false;
      hadCountdownActive.current = false;
    };
  }, []);

  // Calculate grid layout based on number of exercises
  const exerciseCount = currentRound.exercises.length;
  let columns = 4; // Default to 4 columns
  
  if (exerciseCount <= 2) {
    columns = exerciseCount; // 1-2 exercises: show in single row
  } else if (exerciseCount === 3) {
    columns = 2; // 3 exercises: 2 on top, 1 on bottom
  } else if (exerciseCount === 6) {
    columns = 3; // 6 exercises: 3x2 grid
  } else if (exerciseCount === 5) {
    columns = 3; // 5 exercises: 3 on top, 2 on bottom
  } else if (exerciseCount === 7) {
    columns = 4; // 7 exercises: 4 on top, 3 on bottom
  } else if (exerciseCount === 8) {
    columns = 4; // 8 exercises: 4x2 grid
  }
  
  // Calculate rows to determine if we need to scale down
  const rows = Math.ceil(exerciseCount / columns);
  const needsScaling = rows > 1; // Scale for ANY multi-row layout
  const needsHeavyScaling = exerciseCount > 6; // 50% reduction for >6 exercises
  
  return (
    <View style={{ flex: 1, width: '100%' }}>
      {/* Header Section */}
      <View style={{ 
        paddingTop: 0,
        paddingBottom: 30,
        alignItems: 'center',
      }}>
        {/* Timer - replace helper text */}
        {isTimerActive && timeRemaining > 0 ? (
          <Text style={{
            fontSize: 26,
            fontWeight: '800',
            color: TOKENS.color.muted,
            textTransform: 'uppercase',
            letterSpacing: 2,
            marginBottom: 8,
          }}>
            {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
          </Text>
        ) : null}
      </View>

      {/* Exercise Grid */}
      <View style={{ 
        flex: 1, 
        justifyContent: 'center',
        paddingTop: needsScaling ? 20 : 0, // Reduced padding to account for header
      }}>
        <View style={{ 
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginHorizontal: -10,
        }}>
          {currentRound.exercises.map((exercise, idx) => {
            // Fixed width for cards with scaling options
            const baseCardWidth = 380;
            let cardWidth = baseCardWidth;
            
            if (needsHeavyScaling) {
              cardWidth = baseCardWidth * 0.6; // 40% reduction for >6 exercises
            } else if (needsScaling) {
              cardWidth = baseCardWidth * 0.95; // 5% reduction for multi-row
            }
            
            // Adjust vertical padding when scaled
            const verticalPadding = needsHeavyScaling ? 6 : (needsScaling ? 8 : 10);
            
            return (
              <View key={exercise.id} style={{ 
                width: cardWidth,
                paddingHorizontal: 10,
                paddingVertical: verticalPadding,
                flexDirection: 'row',
                alignItems: 'center',
              }}>
                {/* Number outside the card */}
                <Text style={{ 
                  fontSize: needsHeavyScaling ? 33 : (needsScaling ? 46 : 48), 
                  fontWeight: '900',
                  color: TOKENS.color.muted,
                  marginRight: needsHeavyScaling ? 10 : (needsScaling ? 14 : 16),
                  opacity: 0.3,
                  minWidth: needsHeavyScaling ? 36 : (needsScaling ? 57 : 60),
                  textAlign: 'right'
                }}>
                  {idx + 1}
                </Text>
                
                <MattePanel style={{ 
                  flex: 1,
                  paddingHorizontal: needsHeavyScaling ? 14 : (needsScaling ? 22 : 24),
                  paddingVertical: needsHeavyScaling ? 12 : (needsScaling ? 18 : 20),
                  height: needsHeavyScaling ? 72 : (needsScaling ? 114 : 120),
                  justifyContent: 'center',
                }}>
                  {/* Exercise Name */}
                  <Text style={{ 
                    fontSize: needsHeavyScaling ? 17 : (needsScaling ? 22 : 24), 
                    fontWeight: '900',
                    color: TOKENS.color.text,
                    lineHeight: needsHeavyScaling ? 20 : (needsScaling ? 26 : 28),
                    marginBottom: needsHeavyScaling ? 2 : 4,
                    minHeight: needsHeavyScaling ? 20 : (needsScaling ? 26 : 28), // Ensures at least one line height
                  }} numberOfLines={2}>
                    {exercise.exerciseName}
                  </Text>
                  
                  {/* Reps if exists */}
                  {exercise.repsPlanned && (
                    <Text style={{
                      fontSize: needsHeavyScaling ? 12 : (needsScaling ? 15 : 16),
                      fontWeight: '600',
                      color: TOKENS.color.muted,
                      marginTop: needsHeavyScaling ? 1 : 2,
                    }}>
                      {exercise.repsPlanned} {exercise.repsPlanned === 1 ? 'rep' : 'reps'}
                    </Text>
                  )}
                  
                </MattePanel>
              </View>
            );
          })}
        </View>
      </View>
      
      {/* Repeat Indicator - Conditional Position */}
      {repeatTimes > 1 && (
        <View style={{
          position: 'absolute',
          ...(exerciseCount >= 4 ? {
            top: -25,  // Moved down 5px (from -30 to -25)
            right: -12,  // Moved right 30px more (from 18 to -12)
          } : {
            bottom: 40,  // Original position for <4 exercises
            right: 48,
          }),
        }}>
          <MattePanel style={{
            paddingHorizontal: 20,
            paddingVertical: 12,
            gap: 6,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: TOKENS.color.blue + '10',
            borderColor: TOKENS.color.blue,
            borderWidth: 1,
          }}>
            <Text style={{
              fontSize: 13,
              fontWeight: '700',
              color: TOKENS.color.blue,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
            }}>
              Repeat
            </Text>
            <Text style={{
              fontSize: 18,
              fontWeight: '900',
              color: TOKENS.color.blue,
            }}>
              {repeatTimes}×
            </Text>
          </MattePanel>
        </View>
      )}

      {/* Rise Info & Start Button - Only for round 1 with buildup configured */}
      {riseInfo && !isRiseActive && (
        <View style={{
          position: 'absolute',
          bottom: 40,
          left: 48,
        }}>
          <Pressable
            onPress={handleStartRise}
            style={({ focused }) => ({
              opacity: focused ? 1 : 0.9,
              transform: [{ scale: focused ? 1.02 : 1 }],
            })}
          >
            <MattePanel style={{
              paddingHorizontal: 20,
              paddingVertical: 12,
              gap: 4,
              backgroundColor: TOKENS.color.accent + '10',
              borderColor: TOKENS.color.accent,
              borderWidth: 1,
            }}>
              <Text style={{
                fontSize: 13,
                fontWeight: '700',
                color: TOKENS.color.accent,
                textTransform: 'uppercase',
                letterSpacing: 1.2,
              }}>
                Rise
              </Text>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: TOKENS.color.text,
              }}>
                {riseInfo.trackName}
              </Text>
              <Text style={{
                fontSize: 14,
                fontWeight: '500',
                color: TOKENS.color.muted,
              }}>
                {riseInfo.riseDuration}s
              </Text>
            </MattePanel>
          </Pressable>
        </View>
      )}

      {/* Rise Countdown Overlay - Shows 3, 2, 1 before the drop */}
      {isRiseActive && showRiseCountdown && buildupCountdown !== null && buildupCountdown <= 3 && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
        }}>
          <Text style={{
            fontSize: 200,
            fontWeight: '900',
            color: TOKENS.color.accent,
            textShadowColor: 'rgba(0, 0, 0, 0.5)',
            textShadowOffset: { width: 0, height: 4 },
            textShadowRadius: 20,
          }}>
            {buildupCountdown}
          </Text>
        </View>
      )}
    </View>
  );
}