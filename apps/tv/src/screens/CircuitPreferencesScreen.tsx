import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useNavigation } from '../App';
import { useQuery } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';
import { useRealtimeCircuitConfig } from '../hooks/useRealtimeCircuitConfig';
import type { CircuitConfig } from '@acme/db';

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

// Format duration in MM:SS format
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function CircuitPreferencesScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<Date | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [realtimeConfig, setRealtimeConfig] = useState<CircuitConfig | null>(null);

  // Poll for circuit config every 10 seconds as fallback
  const { data: pollingData, isLoading, error: fetchError } = useQuery({
    ...api.circuitConfig.getBySession.queryOptions({ sessionId: sessionId || '' }),
    enabled: !!sessionId,
    refetchInterval: 10000, // Poll every 10 seconds
    refetchIntervalInBackground: true,
  });

  // Real-time updates
  const { isConnected } = useRealtimeCircuitConfig({
    sessionId: sessionId || '',
    onConfigUpdate: (event) => {
      console.log('[TV CircuitPreferences] Realtime config update:', event);
      setRealtimeConfig(event.config);
    },
    onError: (err) => {
      console.error('[TV CircuitPreferences] Realtime error:', err);
    }
  });

  // Use realtime data if available, otherwise fall back to polling
  const circuitConfig = realtimeConfig || pollingData;

  // Update connection state based on polling success
  useEffect(() => {
    if (pollingData !== undefined && !isLoading) {
      if (!fetchError) {
        const now = new Date();
        setLastSuccessfulFetch(now);
        setConnectionState('connected');
      }
    }
  }, [pollingData, isLoading, fetchError]);

  // Handle fetch errors
  useEffect(() => {
    if (fetchError && !isLoading) {
      console.log('[TV CircuitPreferences] Fetch error detected:', fetchError);
      setConnectionState('error');
    }
  }, [fetchError, isLoading]);

  // Format time in 12-hour format
  function formatTime12Hour(date: Date): string {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    
    return `${hours12}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
  }

  if (isLoading && !circuitConfig) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: TOKENS.color.bg }}>
        <ActivityIndicator size="large" color={TOKENS.color.accent} />
        <Text style={{ fontSize: 24, color: TOKENS.color.muted, marginTop: 16 }}>Loading circuit configuration...</Text>
      </View>
    );
  }

  // Format duration for display (e.g., "40s" instead of "0:40")
  const formatDurationShort = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    if (minutes === 0) {
      return `${seconds}s`;
    }
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: TOKENS.color.bg }}>
      {/* Top Bar */}
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 48,
        paddingVertical: 16
      }}>
        <Pressable
          onPress={() => navigation.goBack()}
          focusable
        >
          {({ focused }) => (
            <MattePanel 
              focused={focused}
              style={{ 
                paddingHorizontal: 32,
                paddingVertical: 12,
                backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                borderWidth: focused ? 1 : 1,
                transform: focused ? [{ translateY: -1 }] : [],
              }}
            >
              <Text style={{ color: TOKENS.color.text, fontSize: 18, letterSpacing: 0.2 }}>Back</Text>
            </MattePanel>
          )}
        </Pressable>
        
        <MattePanel style={{ 
          paddingHorizontal: 32,
          paddingVertical: 12,
          opacity: 0.6,
          backgroundColor: 'rgba(255,255,255,0.05)',
        }}>
          <Text style={{ color: TOKENS.color.muted, fontSize: 18 }}>Configurations Locked</Text>
        </MattePanel>
      </View>

      {/* Center Stage */}
      <View style={{ flex: 1, paddingHorizontal: 48, justifyContent: 'center' }}>
        <MattePanel style={{ maxWidth: 624, width: '100%', alignSelf: 'center', padding: 24 }}>
          {/* Title */}
          <Text style={{ 
            fontSize: 26, 
            fontWeight: '700', 
            color: TOKENS.color.text,
            marginBottom: 24,
          }}>
            Session Configuration
          </Text>

          {/* Configuration Grid */}
          <View style={{ gap: 16 }}>
            {/* Row 1 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: TOKENS.color.accent2 
                }} />
                <Text style={{ fontSize: 16, color: TOKENS.color.text }}># of Rounds</Text>
              </View>
              <View style={{ 
                padding: 8, 
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: '#254063',
                borderStyle: 'dashed',
                borderRadius: 10,
                backgroundColor: 'rgba(12,28,47,0.25)',
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '800',
                  color: TOKENS.color.text 
                }}>
                  {(() => {
                    const baseRounds = circuitConfig?.config?.rounds || circuitConfig?.rounds || 3;
                    const repeatEnabled = circuitConfig?.config?.repeatRounds || false;
                    return repeatEnabled ? baseRounds * 2 : baseRounds;
                  })()}
                </Text>
              </View>
            </View>

            {/* Row 2 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: TOKENS.color.accent2 
                }} />
                <Text style={{ fontSize: 16, color: TOKENS.color.text }}># of Exercises per Round</Text>
              </View>
              <View style={{ 
                padding: 8, 
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: '#254063',
                borderStyle: 'dashed',
                borderRadius: 10,
                backgroundColor: 'rgba(12,28,47,0.25)',
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '800',
                  color: TOKENS.color.text 
                }}>
                  {circuitConfig?.config?.exercisesPerRound || circuitConfig?.exercisesPerRound || 6}
                </Text>
              </View>
            </View>

            {/* Row 3 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: TOKENS.color.accent2 
                }} />
                <Text style={{ fontSize: 16, color: TOKENS.color.text }}>Exercise Duration</Text>
              </View>
              <View style={{ 
                padding: 8, 
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: '#254063',
                borderStyle: 'dashed',
                borderRadius: 10,
                backgroundColor: 'rgba(12,28,47,0.25)',
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '800',
                  color: TOKENS.color.text 
                }}>
                  {formatDurationShort(circuitConfig?.config?.workDuration || circuitConfig?.workDuration || 45)}
                </Text>
              </View>
            </View>

            {/* Row 4 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: TOKENS.color.accent2 
                }} />
                <Text style={{ fontSize: 16, color: TOKENS.color.text }}>Rest Duration</Text>
              </View>
              <View style={{ 
                padding: 8, 
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: '#254063',
                borderStyle: 'dashed',
                borderRadius: 10,
                backgroundColor: 'rgba(12,28,47,0.25)',
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '800',
                  color: TOKENS.color.text 
                }}>
                  {formatDurationShort(circuitConfig?.config?.restDuration || circuitConfig?.restDuration || 15)}
                </Text>
              </View>
            </View>

            {/* Row 5 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ 
                  width: 6, 
                  height: 6, 
                  borderRadius: 3, 
                  backgroundColor: TOKENS.color.accent2 
                }} />
                <Text style={{ fontSize: 16, color: TOKENS.color.text }}>Rest Between Rounds</Text>
              </View>
              <View style={{ 
                padding: 8, 
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: '#254063',
                borderStyle: 'dashed',
                borderRadius: 10,
                backgroundColor: 'rgba(12,28,47,0.25)',
              }}>
                <Text style={{ 
                  fontSize: 18, 
                  fontWeight: '800',
                  color: TOKENS.color.text 
                }}>
                  {formatDurationShort(circuitConfig?.config?.restBetweenRounds || circuitConfig?.restBetweenRounds || 60)}
                </Text>
              </View>
            </View>
          </View>
        </MattePanel>
      </View>

      {/* Footer Bar */}
      <View style={{ 
        paddingHorizontal: 48,
        paddingVertical: 24,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View 
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              marginRight: 2,
              backgroundColor: connectionState === 'connecting' ? '#9ca3af' :
                            connectionState === 'connected' ? '#4ade80' : '#ef4444',
              shadowColor: connectionState === 'connected' ? '#4ade80' : '#ef4444',
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            }} 
          />
          <Text style={{ fontSize: 15, color: TOKENS.color.muted }}>
            {connectionState === 'connecting' ? 'Connecting...' :
             connectionState === 'connected' ? `Live - ${lastSuccessfulFetch ? formatTime12Hour(lastSuccessfulFetch) : 'connecting'}` :
             `Disconnected`}
          </Text>
        </View>
      </View>
    </View>
  );
}