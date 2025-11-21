import React, { useMemo } from 'react';
import { View, Text } from 'react-native';

interface LightingDotForPhaseProps {
  scene: { sceneId: string; sceneName: string } | null;
  position?: 'absolute' | 'footer';
  style?: any;
}

export function LightingDotForPhase({ scene, position = 'absolute', style }: LightingDotForPhaseProps) {
  // Extract color from scene name using regex
  const sceneColor = useMemo(() => {
    if (!scene?.sceneName) return '#888888';
    
    // Common color patterns in scene names - muted by 300%
    const colorPatterns = [
      { pattern: /red/i, color: '#aa6b6b' },
      { pattern: /blue/i, color: '#6b6baa' },
      { pattern: /green/i, color: '#6baa6b' },
      { pattern: /yellow/i, color: '#aaaa6b' },
      { pattern: /orange/i, color: '#aa856b' },
      { pattern: /purple/i, color: '#856baa' },
      { pattern: /pink/i, color: '#aa6baa' },
      { pattern: /cyan/i, color: '#6baaaa' },
      { pattern: /white/i, color: '#aaaaaa' },
      { pattern: /warm/i, color: '#aa916b' },
      { pattern: /cool/i, color: '#6b85aa' },
      { pattern: /gold/i, color: '#aa9955' },
      { pattern: /turquoise/i, color: '#6b9a95' },
      { pattern: /magenta/i, color: '#aa55aa' },
      { pattern: /violet/i, color: '#9e849e' },
      { pattern: /indigo/i, color: '#6a5584' },
      { pattern: /coral/i, color: '#aa806e' },
      { pattern: /salmon/i, color: '#a6847e' },
      { pattern: /lime/i, color: '#55aa55' },
      { pattern: /aqua/i, color: '#55aaaa' },
      { pattern: /teal/i, color: '#558585' },
      { pattern: /navy/i, color: '#555585' },
      { pattern: /maroon/i, color: '#855555' },
      { pattern: /olive/i, color: '#858555' },
      { pattern: /silver/i, color: '#959595' },
      { pattern: /crimson/i, color: '#996b6e' },
      { pattern: /amber/i, color: '#aa9255' },
      { pattern: /emerald/i, color: '#6e958a' },
      { pattern: /ruby/i, color: '#9a5d75' },
      { pattern: /sapphire/i, color: '#5d6e91' },
      { pattern: /ocean/i, color: '#556e82' },
      { pattern: /forest/i, color: '#648564' },
      { pattern: /sunset/i, color: '#aa7c71' },
      { pattern: /rose/i, color: '#aa5580' },
      { pattern: /lavender/i, color: '#9a9aa1' },
      { pattern: /mint/i, color: '#85aa85' },
      { pattern: /peach/i, color: '#aa9d91' },
      { pattern: /cherry/i, color: '#986b79' },
      { pattern: /plum/i, color: '#856e84' },
      { pattern: /bronze/i, color: '#988068' },
    ];
    
    // Check each pattern
    for (const { pattern, color } of colorPatterns) {
      if (pattern.test(scene.sceneName)) {
        return color;
      }
    }
    
    // Default to a neutral color if no match
    return '#888888';
  }, [scene?.sceneName]);

  // Position styles
  const positionStyle = position === 'absolute' 
    ? { 
        position: 'absolute' as const,
        bottom: 20,
        left: 50,
      }
    : {};

  if (!scene) {
    return null;
  }

  return (
    <View style={[{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    }, positionStyle, style]}>
      {/* Status Dot */}
      <View style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: sceneColor,
        shadowColor: sceneColor,
        shadowOpacity: 0.6,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
      }} />
      
      {/* Scene Name */}
      <Text style={{
        fontSize: 12,
        color: '#9cb0ff',
        fontStyle: 'italic',
      }}>
        {scene.sceneName}
      </Text>
    </View>
  );
}