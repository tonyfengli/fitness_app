import React, { useMemo, useEffect } from 'react';
import { View, Text } from 'react-native';
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
}

export function CircuitRoundPreview({ currentRound, repeatTimes = 1, timeRemaining = 0, isTimerActive = false, roundNumber, currentRoundIndex = 0, circuitConfig }: CircuitRoundPreviewProps) {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  const { tracks, preSelectedRiseTrack, preSelectRiseTrack, clearPreSelectedRiseTrack } = useMusic();

  console.log('[CircuitRoundPreview] RENDER:', { currentRoundIndex, hasCircuitConfig: !!circuitConfig, tracksCount: tracks.length, hasPreSelected: !!preSelectedRiseTrack });

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
      console.log('[CircuitRoundPreview] Pre-selecting random rise track for round 1');
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
    console.log('[CircuitRoundPreview] riseInfo calculation:', {
      currentRoundIndex,
      hasCircuitConfig: !!circuitConfig,
      tracksCount: tracks.length,
      hasPreSelected: !!preSelectedRiseTrack,
    });

    // Only show for round 1 (index 0)
    if (currentRoundIndex !== 0) {
      console.log('[CircuitRoundPreview] Not round 1, skipping');
      return null;
    }

    console.log('[CircuitRoundPreview] Exercise 1 trigger:', exercise1Trigger);

    if (!exercise1Trigger?.enabled || !exercise1Trigger?.useBuildup) {
      console.log('[CircuitRoundPreview] No buildup configured for exercise 1');
      return null;
    }

    // Check for specific track first
    const trackId = exercise1Trigger.trackId;
    if (trackId) {
      const track = tracks.find(t => t.id === trackId);
      console.log('[CircuitRoundPreview] Specific track lookup:', { trackId, trackFound: !!track });

      if (track) {
        const segments = track.segments || [];
        const mediumSegment = segments.find(s => s.energy === 'medium');
        const highSegment = segments.find(s => s.energy === 'high');

        if (mediumSegment && highSegment) {
          const riseDuration = highSegment.timestamp - mediumSegment.timestamp;
          console.log('[CircuitRoundPreview] Rise info from specific track:', {
            trackName: track.name,
            riseDuration,
          });
          return {
            trackName: track.name,
            riseDuration: Math.round(riseDuration * 10) / 10,
          };
        }
      }
    }

    // Use pre-selected track for random mode
    if (preSelectedRiseTrack) {
      console.log('[CircuitRoundPreview] Rise info from pre-selected track:', {
        trackName: preSelectedRiseTrack.track.name,
        riseDuration: preSelectedRiseTrack.riseDuration,
      });
      return {
        trackName: preSelectedRiseTrack.track.name,
        riseDuration: preSelectedRiseTrack.riseDuration,
      };
    }

    console.log('[CircuitRoundPreview] No track available for rise info');
    return null;
  }, [currentRoundIndex, circuitConfig, tracks, exercise1Trigger, preSelectedRiseTrack]);
  
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

      {/* Rise Info - Only for round 1 with buildup configured */}
      {riseInfo && (
        <View style={{
          position: 'absolute',
          bottom: 40,
          left: 48,
        }}>
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
        </View>
      )}
    </View>
  );
}