import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useLightingPreview } from '../hooks/useLightingPreview';
import { useNavigation } from '../App';

interface LightingDotWithTimestampProps {
  position?: 'footer' | 'absolute';
  style?: any;
  roundNumber?: number;
}

export function LightingDotWithTimestamp({ position = 'footer', style, roundNumber }: LightingDotWithTimestampProps) {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  
  // Default to round 1 if not specified
  const currentRoundNumber = roundNumber || 1;
  
  // Get lighting preview
  const { lightingConfig } = useLightingPreview({ 
    sessionId: sessionId || '', 
    roundNumber: currentRoundNumber, 
    enabled: !!sessionId 
  });

  // Get scene data directly from the config
  const currentScene = useMemo(() => {
    if (!lightingConfig || !lightingConfig.enabled) return null;
    
    const roundKey = `round-${currentRoundNumber}`;
    
    // Check round-specific preview override first
    const roundPreview = lightingConfig.roundOverrides?.[roundKey]?.preview;
    if (roundPreview) {
      return roundPreview;
    }
    
    // Fallback to global default preview
    const globalPreview = lightingConfig.globalDefaults?.preview;
    if (globalPreview) {
      return globalPreview;
    }
    
    return null;
  }, [lightingConfig, currentRoundNumber]);

  // Extract color from scene name using regex
  const sceneColor = useMemo(() => {
    if (!currentScene?.sceneName) return '#888888';
    
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
      if (pattern.test(currentScene.sceneName)) {
        return color;
      }
    }
    
    // Default to a neutral color if no match
    return '#888888';
  }, [currentScene?.sceneName]);

  // Simple lighting status - default to success when we have scene data
  const lightingStatus = currentScene ? 'success' : 'unknown';

  // Position styles
  const positionStyle = position === 'absolute' 
    ? { 
        position: 'absolute' as const,
        bottom: -35,
        left: 50,
      }
    : {};

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
        backgroundColor: lightingStatus === 'success' ? sceneColor : 
                       lightingStatus === 'error' ? '#ff4444' : 
                       '#888888',
        shadowColor: lightingStatus === 'success' ? sceneColor : '#888888',
        shadowOpacity: lightingStatus === 'success' ? 0.6 : 0.3,
        shadowRadius: lightingStatus === 'success' ? 6 : 3,
        shadowOffset: { width: 0, height: 0 },
      }} />
      
      {/* Scene Name */}
      {currentScene && (
        <Text style={{
          fontSize: 12,
          color: '#9cb0ff',
          fontStyle: 'italic',
        }}>
          {currentScene.sceneName}
        </Text>
      )}
      
      {/* Loading state */}
      {!currentScene && sessionId && (
        <Text style={{
          fontSize: 12,
          color: '#666',
          fontStyle: 'italic',
        }}>
          Checking...
        </Text>
      )}
    </View>
  );
}