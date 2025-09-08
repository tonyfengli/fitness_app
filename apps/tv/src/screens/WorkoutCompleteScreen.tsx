import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '../App';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { setHueLights } from '../lib/lighting';
import { getColorForPreset, getHuePresetForColor } from '../lib/lighting/colorMappings';

// Design tokens - matching other screens
const TOKENS = {
  color: {
    bg: '#070b18',
    card: '#111928',
    text: '#ffffff',
    muted: '#9cb0ff',
    accent: '#7cffb5',
    accent2: '#5de1ff',
    focusRing: 'rgba(124,255,181,0.6)',
    borderGlass: 'rgba(255,255,255,0.08)',
    cardGlass: 'rgba(255,255,255,0.04)',
  },
  radius: {
    card: 16,
    chip: 999,
  },
};

// Matte panel helper component - matching other screens
function MattePanel({
  children,
  style,
  focused = false,
  radius = TOKENS.radius.card,
}: {
  children: React.ReactNode;
  style?: any;
  focused?: boolean;
  radius?: number;
}) {
  const BASE_SHADOW = {
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.40,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
  };
  const FOCUS_SHADOW = {
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.36,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 12 },
  };

  return (
    <View
      style={[
        {
          backgroundColor: TOKENS.color.card,
          borderColor: TOKENS.color.borderGlass,
          borderWidth: 1,
          borderRadius: radius,
        },
        focused ? FOCUS_SHADOW : BASE_SHADOW,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function WorkoutCompleteScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  const totalRounds = navigation.getParam('totalRounds') || 1;
  const [isCompleting, setIsCompleting] = useState(false);
  
  // Get the passed data to ensure we can navigate back properly
  const organization = navigation.getParam('organization');
  const workouts = navigation.getParam('workouts');
  const clients = navigation.getParam('clients');
  
  // Apply cooldown lighting on mount
  useEffect(() => {
    getColorForPreset('strength_cooldown').then(color => {
      const preset = getHuePresetForColor(color);
      setHueLights(preset);
    });
    
    // Apply App Start color when leaving
    return () => {
      getColorForPreset('app_start').then(color => {
        const preset = getHuePresetForColor(color);
        setHueLights(preset);
      });
    };
  }, []);
  
  // Fetch session data for any additional info we might want to display
  const { data: sessionData } = useQuery(
    sessionId ? api.trainingSession.getById.queryOptions({ id: sessionId }) : {
      enabled: false,
      queryKey: ['disabled-session-complete'],
      queryFn: () => Promise.resolve(null)
    }
  );

  // Complete session mutation with name update
  const completeSessionMutation = useMutation({
    ...api.trainingSession.completeSessionWithName.mutationOptions(),
    onSuccess: async () => {
      console.log('[WorkoutCompleteScreen] Session completed successfully');
      // Apply App Start color before navigating
      const color = await getColorForPreset('app_start');
      const preset = getHuePresetForColor(color);
      await setHueLights(preset);
      // Navigate to main screen
      navigation.navigate('Main');
    },
    onError: (error: any) => {
      console.error('[WorkoutCompleteScreen] Failed to complete session:', error);
      setIsCompleting(false);
      Alert.alert(
        'Complete Failed',
        error.message || 'Failed to complete workout. Please try again.',
        [{ text: 'OK' }]
      );
    },
  });

  // Function to generate session name from client names
  const generateSessionName = () => {
    if (!clients || clients.length === 0) return 'Training Session';
    
    const names = clients.map(c => c.userName || c.name || 'Unknown');
    
    if (names.length <= 4) {
      return names.join(' • ');
    } else {
      const firstThree = names.slice(0, 3);
      const remaining = names.length - 3;
      return `${firstThree.join(' • ')} +${remaining} more`;
    }
  };


  const handleBackToLastRound = () => {
    // Navigate back to the last round with all necessary data
    navigation.navigate('WorkoutLive', { 
      sessionId, 
      round: totalRounds,
      organization,
      workouts,
      clients
    });
  };

  const handleCompleteWorkout = () => {
    if (isCompleting) return;
    
    Alert.alert(
      'Complete Workout',
      'Are you sure you want to complete this workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'default',
          onPress: () => {
            setIsCompleting(true);
            const sessionName = generateSessionName();
            completeSessionMutation.mutate({ 
              sessionId,
              name: sessionName
            });
          }
        }
      ]
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: TOKENS.color.bg }}>
      {/* Center content vertically and horizontally */}
      <View className="flex-1 items-center justify-center" style={{ padding: 24 }}>
        
        {/* Success icon/emoji */}
        <Text style={{ fontSize: 96, marginBottom: 32 }}>🎉</Text>
        
        {/* Main title */}
        <Text style={{ 
          fontSize: 48, 
          fontWeight: '900', 
          letterSpacing: -0.4,
          lineHeight: 48 * 1.05,
          color: TOKENS.color.text,
          marginBottom: 16,
          textAlign: 'center'
        }}>
          Workout Complete!
        </Text>
        
        {/* Subtitle */}
        <Text style={{ 
          fontSize: 24, 
          color: TOKENS.color.muted,
          marginBottom: 64,
          textAlign: 'center'
        }}>
          Great job completing all {totalRounds} rounds
        </Text>
        
        {/* Button container */}
        <View className="flex-row" style={{ gap: 24 }}>
          {/* Back button */}
          <Pressable
            onPress={handleBackToLastRound}
            focusable
            hasTVPreferredFocus
          >
            {({ focused }) => (
              <MattePanel 
                focused={focused}
                style={{ 
                  paddingHorizontal: 48,
                  paddingVertical: 16,
                  backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                  borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                  borderWidth: focused ? 1 : 1,
                  transform: focused ? [{ translateY: -1 }] : [],
                }}
              >
                <Text style={{ 
                  color: TOKENS.color.text, 
                  fontSize: 20, 
                  letterSpacing: 0.2,
                  fontWeight: '600'
                }}>
                  Back
                </Text>
              </MattePanel>
            )}
          </Pressable>
          
          {/* Complete button */}
          <Pressable
            onPress={handleCompleteWorkout}
            focusable
            disabled={isCompleting}
          >
            {({ focused }) => (
              <MattePanel 
                focused={focused}
                style={{ 
                  paddingHorizontal: 48,
                  paddingVertical: 16,
                  backgroundColor: focused ? TOKENS.color.accent : TOKENS.color.card,
                  borderColor: focused ? TOKENS.color.accent : TOKENS.color.borderGlass,
                  borderWidth: 2,
                  transform: focused ? [{ translateY: -1 }] : [],
                  opacity: isCompleting ? 0.5 : 1,
                }}
              >
                {isCompleting ? (
                  <ActivityIndicator size="small" color={focused ? TOKENS.color.bg : TOKENS.color.accent} />
                ) : (
                  <Text style={{ 
                    color: focused ? TOKENS.color.bg : TOKENS.color.accent, 
                    fontSize: 20, 
                    letterSpacing: 0.2,
                    fontWeight: '700'
                  }}>
                    Complete Workout
                  </Text>
                )}
              </MattePanel>
            )}
          </Pressable>
        </View>
        
        {/* Session info at bottom */}
        {sessionData && (
          <View style={{ 
            position: 'absolute', 
            bottom: 24, 
            left: 24, 
            right: 24,
            alignItems: 'center' 
          }}>
            <Text style={{ 
              fontSize: 14, 
              color: TOKENS.color.muted,
              opacity: 0.6
            }}>
              Session ID: {sessionId}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}