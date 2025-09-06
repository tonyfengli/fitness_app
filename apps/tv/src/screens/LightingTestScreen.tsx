import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '../App';
import { 
  setHueLights, 
  LIGHTING_PRESETS,
  startDriftAnimation,
  startBreatheAnimation,
  roundFlash,
  startCountdownPulse,
  setPauseState,
  stopAnimation,
  subscribeLightingStatus
} from '../lib/lighting';

// Design tokens
const TOKENS = {
  color: {
    bg: '#070b18',
    card: '#111928',
    text: '#ffffff',
    muted: '#9cb0ff',
    accent: '#5de1ff',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    focusRing: 'rgba(124,255,181,0.6)',
    borderGlass: 'rgba(255,255,255,0.08)',
  },
  radius: {
    card: 16,
  },
};

interface PresetButton {
  label: string;
  onPress: () => void;
  color: string;
}

export function LightingTestScreen() {
  const navigation = useNavigation();
  const [customState, setCustomState] = useState({
    on: true,
    bri: 254,
    hue: 0,
    sat: 254,
    transitiontime: 10,
  });
  const [lightingStatus, setLightingStatus] = useState<'unknown' | 'success' | 'slow' | 'failed'>('unknown');
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeLightingStatus((status) => {
      setLightingStatus(status);
    });
    
    return () => unsubscribe();
  }, []);

  const circuitPresets: PresetButton[] = [
    { 
      label: 'Warmup', 
      onPress: () => setHueLights(LIGHTING_PRESETS.circuit.WARMUP), 
      color: '#fb923c' 
    },
    { 
      label: 'Work', 
      onPress: () => setHueLights(LIGHTING_PRESETS.circuit.WORK), 
      color: '#a855f7' 
    },
    { 
      label: 'Rest', 
      onPress: () => setHueLights(LIGHTING_PRESETS.circuit.REST), 
      color: '#22c55e' 
    },
    { 
      label: 'Cooldown', 
      onPress: () => setHueLights(LIGHTING_PRESETS.circuit.COOLDOWN), 
      color: '#3b82f6' 
    },
    { 
      label: 'Default', 
      onPress: () => setHueLights(LIGHTING_PRESETS.circuit.DEFAULT), 
      color: '#6b7280' 
    },
  ];

  const strengthPresets: PresetButton[] = [
    { 
      label: 'Warmup', 
      onPress: () => setHueLights(LIGHTING_PRESETS.strength.WARMUP), 
      color: '#fb923c' 
    },
    { 
      label: 'Round Start', 
      onPress: () => setHueLights(LIGHTING_PRESETS.strength.ROUND_START), 
      color: '#a855f7' 
    },
    { 
      label: 'Round Rest', 
      onPress: () => setHueLights(LIGHTING_PRESETS.strength.ROUND_REST), 
      color: '#f97316' 
    },
    { 
      label: 'Cooldown', 
      onPress: () => setHueLights(LIGHTING_PRESETS.strength.COOLDOWN), 
      color: '#3b82f6' 
    },
    { 
      label: 'Default', 
      onPress: () => setHueLights(LIGHTING_PRESETS.strength.DEFAULT), 
      color: '#6b7280' 
    },
  ];

  const animations: PresetButton[] = [
    { 
      label: 'Drift', 
      onPress: () => {
        stopAnimation();
        startDriftAnimation();
        setCurrentAnimation('drift');
      }, 
      color: '#a855f7' 
    },
    { 
      label: 'Breathe', 
      onPress: () => {
        stopAnimation();
        startBreatheAnimation();
        setCurrentAnimation('breathe');
      }, 
      color: '#22c55e' 
    },
    { 
      label: 'Countdown', 
      onPress: () => {
        stopAnimation();
        startCountdownPulse();
        setCurrentAnimation('countdown');
      }, 
      color: '#f97316' 
    },
    { 
      label: 'Flash', 
      onPress: () => {
        roundFlash();
      }, 
      color: '#fbbf24' 
    },
    { 
      label: 'Pause', 
      onPress: () => {
        stopAnimation();
        setPauseState();
        setCurrentAnimation(null);
      }, 
      color: '#6b7280' 
    },
    { 
      label: 'Stop', 
      onPress: () => {
        stopAnimation();
        setCurrentAnimation(null);
      }, 
      color: '#ef4444' 
    },
  ];

  const applyCustomState = () => {
    setHueLights(customState);
  };

  const getStatusColor = () => {
    switch (lightingStatus) {
      case 'success': return TOKENS.color.success;
      case 'slow': return TOKENS.color.warning;
      case 'failed': return TOKENS.color.error;
      default: return TOKENS.color.muted;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: TOKENS.color.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 48 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <Text style={{ fontSize: 40, fontWeight: '900', color: TOKENS.color.text }}>
            Lighting Test
          </Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            {/* Status Indicator */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ 
                width: 12, 
                height: 12, 
                borderRadius: 6, 
                backgroundColor: getStatusColor() 
              }} />
              <Text style={{ color: TOKENS.color.muted, fontSize: 16 }}>
                {lightingStatus}
              </Text>
            </View>
            
            {/* Current Animation */}
            {currentAnimation && (
              <View style={{ 
                backgroundColor: TOKENS.color.card, 
                paddingHorizontal: 16, 
                paddingVertical: 8, 
                borderRadius: TOKENS.radius.card 
              }}>
                <Text style={{ color: TOKENS.color.success, fontSize: 14 }}>
                  {currentAnimation} running
                </Text>
              </View>
            )}
            
            {/* Back Button */}
            <Pressable
              onPress={() => navigation.goBack()}
              focusable
            >
              {({ focused }) => (
                <View style={{
                  backgroundColor: focused ? 'rgba(255,255,255,0.16)' : TOKENS.color.card,
                  borderColor: focused ? 'rgba(255,255,255,0.45)' : TOKENS.color.borderGlass,
                  borderWidth: 1,
                  borderRadius: TOKENS.radius.card,
                  paddingHorizontal: 32,
                  paddingVertical: 12,
                  transform: focused ? [{ translateY: -1 }] : [],
                }}>
                  <Text style={{ color: TOKENS.color.text, fontSize: 18 }}>Back</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Custom State Controls */}
        <View style={{
          backgroundColor: TOKENS.color.card,
          borderRadius: TOKENS.radius.card,
          borderWidth: 1,
          borderColor: TOKENS.color.borderGlass,
          padding: 24,
          marginBottom: 24,
        }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: TOKENS.color.text, marginBottom: 16 }}>
            Custom State
          </Text>
          
          <View style={{ gap: 16 }}>
            {/* Brightness */}
            <View>
              <Text style={{ color: TOKENS.color.muted, marginBottom: 8 }}>
                Brightness: {customState.bri}
              </Text>
              <Slider
                value={customState.bri}
                onValueChange={(val) => setCustomState({...customState, bri: Math.round(val)})}
                minimumValue={1}
                maximumValue={254}
              />
            </View>
            
            {/* Hue */}
            <View>
              <Text style={{ color: TOKENS.color.muted, marginBottom: 8 }}>
                Hue: {customState.hue}
              </Text>
              <Slider
                value={customState.hue}
                onValueChange={(val) => setCustomState({...customState, hue: Math.round(val)})}
                minimumValue={0}
                maximumValue={65535}
              />
            </View>
            
            {/* Saturation */}
            <View>
              <Text style={{ color: TOKENS.color.muted, marginBottom: 8 }}>
                Saturation: {customState.sat}
              </Text>
              <Slider
                value={customState.sat}
                onValueChange={(val) => setCustomState({...customState, sat: Math.round(val)})}
                minimumValue={0}
                maximumValue={254}
              />
            </View>
            
            {/* Transition Time */}
            <View>
              <Text style={{ color: TOKENS.color.muted, marginBottom: 8 }}>
                Transition: {customState.transitiontime / 10}s
              </Text>
              <Slider
                value={customState.transitiontime}
                onValueChange={(val) => setCustomState({...customState, transitiontime: Math.round(val)})}
                minimumValue={0}
                maximumValue={50}
              />
            </View>
          </View>
          
          <Pressable
            onPress={applyCustomState}
            focusable
            style={{ marginTop: 16 }}
          >
            {({ focused }) => (
              <View style={{
                backgroundColor: focused ? '#4f46e5' : '#6366f1',
                borderRadius: TOKENS.radius.card,
                paddingVertical: 12,
                alignItems: 'center',
                transform: focused ? [{ translateY: -1 }] : [],
              }}>
                <Text style={{ color: TOKENS.color.text, fontSize: 16, fontWeight: '600' }}>
                  Apply Custom State
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Circuit Presets */}
        <PresetSection title="Circuit Presets" presets={circuitPresets} />
        
        {/* Strength Presets */}
        <PresetSection title="Strength Presets" presets={strengthPresets} />
        
        {/* Animations */}
        <PresetSection title="Animations" presets={animations} />
      </ScrollView>
    </View>
  );
}

function PresetSection({ title, presets }: { title: string; presets: PresetButton[] }) {
  return (
    <View style={{
      backgroundColor: TOKENS.color.card,
      borderRadius: TOKENS.radius.card,
      borderWidth: 1,
      borderColor: TOKENS.color.borderGlass,
      padding: 24,
      marginBottom: 24,
    }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: TOKENS.color.text, marginBottom: 16 }}>
        {title}
      </Text>
      
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {presets.map((preset, index) => (
          <Pressable
            key={index}
            onPress={preset.onPress}
            focusable
          >
            {({ focused }) => (
              <View style={{
                backgroundColor: focused ? preset.color : `${preset.color}99`,
                borderRadius: TOKENS.radius.card,
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderWidth: focused ? 2 : 0,
                borderColor: preset.color,
                transform: focused ? [{ translateY: -2, scale: 1.05 }] : [],
              }}>
                <Text style={{ color: TOKENS.color.text, fontSize: 16, fontWeight: '600' }}>
                  {preset.label}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Simple slider component
function Slider({ value, onValueChange, minimumValue, maximumValue }: {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue: number;
  maximumValue: number;
}) {
  const percentage = ((value - minimumValue) / (maximumValue - minimumValue)) * 100;
  
  return (
    <View style={{
      height: 40,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: 20,
      overflow: 'hidden',
    }}>
      <View style={{
        width: `${percentage}%`,
        height: '100%',
        backgroundColor: TOKENS.color.accent,
        borderRadius: 20,
      }} />
    </View>
  );
}