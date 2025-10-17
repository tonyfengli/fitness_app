import React from 'react';
import { View, Text } from 'react-native';
import { TOKENS } from './types';
import { TimerDisplay } from './TimerDisplay';

interface SetBreakViewProps {
  timeRemaining: number;
  currentSetNumber: number;
  totalSets: number;
}

export function SetBreakView({ timeRemaining, currentSetNumber, totalSets }: SetBreakViewProps) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 }}>
      {/* Main Timer */}
      <TimerDisplay 
        timeRemaining={timeRemaining}
        size="xlarge"
        color={TOKENS.color.accent2}
        style={{ marginBottom: 40 }}
      />
      
      {/* Set Break Label */}
      <Text style={{ 
        fontSize: 48, 
        fontWeight: '700', 
        color: TOKENS.color.text, 
        marginBottom: 12,
        textAlign: 'center'
      }}>
        Set Break
      </Text>
      
      {/* Next Set Info */}
      <Text style={{ 
        fontSize: 20, 
        fontWeight: '500',
        color: TOKENS.color.muted,
        opacity: 0.7
      }}>
        Next: Set {currentSetNumber} of {totalSets}
      </Text>
      
      {/* Repeat Progress Indicator for Set Break */}
      <View style={{
        position: 'absolute',
        top: -48,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
      }}>
        <View style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          gap: 6,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: TOKENS.color.accent + '15',
          borderColor: TOKENS.color.accent,
          borderWidth: 1,
          borderRadius: 999,
        }}>
          <Text style={{
            fontSize: 13,
            fontWeight: '700',
            color: TOKENS.color.accent,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
          }}>
            Completing Set
          </Text>
          <Text style={{
            fontSize: 16,
            fontWeight: '800',
            color: TOKENS.color.accent,
            marginLeft: 2,
          }}>
            {currentSetNumber - 1}
          </Text>
          <Text style={{
            fontSize: 13,
            fontWeight: '500',
            color: TOKENS.color.accent,
            marginHorizontal: 3,
          }}>
            of
          </Text>
          <Text style={{
            fontSize: 16,
            fontWeight: '800',
            color: TOKENS.color.accent,
          }}>
            {totalSets}
          </Text>
        </View>
      </View>
    </View>
  );
}