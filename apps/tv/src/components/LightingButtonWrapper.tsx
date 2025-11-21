import React, { useMemo, ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';
import { useLightingPreview } from '../hooks/useLightingPreview';
import { useQuery } from '@tanstack/react-query';
import { api } from '../providers/TRPCProvider';

interface LightingButtonWrapperProps {
  sessionId: string;
  roundNumber: number;
  children: ReactNode;
  focused?: boolean;
  style?: ViewStyle;
}

// Design tokens
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
  },
};

export function LightingButtonWrapper({ 
  sessionId, 
  roundNumber, 
  children, 
  focused = false,
  style 
}: LightingButtonWrapperProps) {
  // Get lighting preview
  const { lightingConfig, currentPreviewScene } = useLightingPreview({ 
    sessionId, 
    roundNumber, 
    enabled: true 
  });

  // Get full scene data
  const { data: sceneData } = useQuery({
    ...api.lighting.getSceneDataForPreview.queryOptions({ sessionId, roundNumber }),
    enabled: !!sessionId && !!lightingConfig && !!currentPreviewScene
  });

  const currentScene = sceneData?.scene;

  // Extract color from scene name using regex
  const sceneColor = useMemo(() => {
    if (!currentScene?.sceneName) return null;
    
    // Common color patterns in scene names
    const colorPatterns = [
      { pattern: /red/i, color: '#ff4444' },
      { pattern: /blue/i, color: '#4444ff' },
      { pattern: /green/i, color: '#44ff44' },
      { pattern: /yellow/i, color: '#ffff44' },
      { pattern: /orange/i, color: '#ff8844' },
      { pattern: /purple/i, color: '#8844ff' },
      { pattern: /pink/i, color: '#ff44ff' },
      { pattern: /cyan/i, color: '#44ffff' },
      { pattern: /white/i, color: '#ffffff' },
      { pattern: /warm/i, color: '#ffaa44' },
      { pattern: /cool/i, color: '#4488ff' },
      { pattern: /gold/i, color: '#ffd700' },
      { pattern: /turquoise/i, color: '#40e0d0' },
      { pattern: /magenta/i, color: '#ff00ff' },
      { pattern: /violet/i, color: '#ee82ee' },
      { pattern: /indigo/i, color: '#4b0082' },
      { pattern: /coral/i, color: '#ff7f50' },
      { pattern: /salmon/i, color: '#fa8072' },
      { pattern: /lime/i, color: '#00ff00' },
      { pattern: /aqua/i, color: '#00ffff' },
      { pattern: /teal/i, color: '#008080' },
      { pattern: /navy/i, color: '#000080' },
      { pattern: /maroon/i, color: '#800000' },
      { pattern: /olive/i, color: '#808000' },
      { pattern: /silver/i, color: '#c0c0c0' },
      { pattern: /crimson/i, color: '#dc143c' },
      { pattern: /amber/i, color: '#ffbf00' },
      { pattern: /emerald/i, color: '#50c878' },
      { pattern: /ruby/i, color: '#e0115f' },
      { pattern: /sapphire/i, color: '#0f52ba' },
      { pattern: /ocean/i, color: '#006994' },
      { pattern: /forest/i, color: '#228b22' },
      { pattern: /sunset/i, color: '#ff6b4a' },
      { pattern: /rose/i, color: '#ff007f' },
      { pattern: /lavender/i, color: '#e6e6fa' },
      { pattern: /mint/i, color: '#98ff98' },
      { pattern: /peach/i, color: '#ffe5b4' },
      { pattern: /cherry/i, color: '#de3163' },
      { pattern: /plum/i, color: '#8e4585' },
      { pattern: /bronze/i, color: '#cd7f32' },
    ];
    
    // Check each pattern
    for (const { pattern, color } of colorPatterns) {
      if (pattern.test(currentScene.sceneName)) {
        return color;
      }
    }
    
    // Default subtle accent if no color found
    return TOKENS.color.accent2;
  }, [currentScene?.sceneName]);

  // Calculate glow effect based on scene color
  const glowStyle = useMemo(() => {
    if (!currentScene || !sceneColor) return {};
    
    // Create a subtle animated glow effect
    return {
      shadowColor: sceneColor,
      shadowOpacity: focused ? 0.5 : 0.3,
      shadowRadius: focused ? 20 : 15,
      shadowOffset: { width: 0, height: 0 },
      // Add a subtle border
      borderWidth: 1.5,
      borderColor: `${sceneColor}40`, // 25% opacity
    };
  }, [currentScene, sceneColor, focused]);

  // If no lighting scene, render children without wrapper
  if (!currentScene) {
    return <>{children}</>;
  }

  return (
    <View style={[
      {
        position: 'relative',
        borderRadius: 16,
      },
      glowStyle,
      style
    ]}>
      {/* Subtle gradient overlay for depth */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 16,
        backgroundColor: `${sceneColor}08`, // Very subtle tint
        pointerEvents: 'none',
      }} />
      
      {/* Corner accent - top right */}
      <View style={{
        position: 'absolute',
        top: -2,
        right: -2,
        width: 20,
        height: 20,
        borderTopRightRadius: 16,
        borderTopWidth: 2,
        borderRightWidth: 2,
        borderColor: sceneColor,
        opacity: 0.6,
        pointerEvents: 'none',
      }} />
      
      {/* Corner accent - bottom left */}
      <View style={{
        position: 'absolute',
        bottom: -2,
        left: -2,
        width: 20,
        height: 20,
        borderBottomLeftRadius: 16,
        borderBottomWidth: 2,
        borderLeftWidth: 2,
        borderColor: sceneColor,
        opacity: 0.6,
        pointerEvents: 'none',
      }} />
      
      {children}
    </View>
  );
}