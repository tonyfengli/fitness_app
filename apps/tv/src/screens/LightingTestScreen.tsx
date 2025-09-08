import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '../App';
import { 
  setHueLights, 
  LIGHTING_PRESETS,
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

// Hardcoded color palette
const COLOR_PALETTE = [
  { name: 'Red', value: '#ef4444', hue: 0 },
  { name: 'Orange', value: '#f97316', hue: 8000 },
  { name: 'Yellow', value: '#eab308', hue: 10000 },
  { name: 'Green', value: '#22c55e', hue: 25000 },
  { name: 'Blue', value: '#3b82f6', hue: 45000 },
  { name: 'Purple', value: '#a855f7', hue: 50000 },
];

interface PresetButton {
  label: string;
  onPress: () => void;
  color: string;
}

export function LightingTestScreen() {
  const navigation = useNavigation();
  const [lightingStatus, setLightingStatus] = useState<'unknown' | 'success' | 'slow' | 'failed'>('unknown');
  const [selectedCircuitPreset, setSelectedCircuitPreset] = useState<string | null>(null);
  const [selectedStrengthPreset, setSelectedStrengthPreset] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const unsubscribe = subscribeLightingStatus((status) => {
      setLightingStatus(status);
    });
    
    return () => unsubscribe();
  }, []);

  const handlePresetClick = (preset: string, type: 'circuit' | 'strength') => {
    if (type === 'circuit') {
      setSelectedCircuitPreset(selectedCircuitPreset === preset ? null : preset);
      setSelectedStrengthPreset(null);
    } else {
      setSelectedStrengthPreset(selectedStrengthPreset === preset ? null : preset);
      setSelectedCircuitPreset(null);
    }
  };

  const handleColorSelect = (presetKey: string, color: typeof COLOR_PALETTE[0]) => {
    setSelectedColors({ ...selectedColors, [presetKey]: color.value });
    // Collapse the color palette after selection
    setSelectedCircuitPreset(null);
    setSelectedStrengthPreset(null);
    // For now, just update the visual state
    console.log(`Color ${color.name} selected for ${presetKey}`);
  };

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

  const getStatusColor = () => {
    switch (lightingStatus) {
      case 'success': return TOKENS.color.success;
      case 'slow': return TOKENS.color.warning;
      case 'failed': return TOKENS.color.error;
      default: return TOKENS.color.muted;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: TOKENS.color.bg, padding: 41 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 27 }}>
        <Text style={{ fontSize: 34, fontWeight: '900', color: TOKENS.color.text }}>
          Lighting Configuration
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
            <Text style={{ color: TOKENS.color.muted, fontSize: 14 }}>
              {lightingStatus}
            </Text>
          </View>
          
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
                paddingHorizontal: 27,
                paddingVertical: 10,
                transform: focused ? [{ translateY: -1 }] : [],
              }}>
                <Text style={{ color: TOKENS.color.text, fontSize: 15 }}>Back</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: 20 }}>
        {/* Circuit Presets */}
        <PresetSection 
          title="Circuit Presets" 
          presets={circuitPresets}
          selectedPreset={selectedCircuitPreset}
          onPresetClick={(preset) => handlePresetClick(preset, 'circuit')}
          onColorSelect={handleColorSelect}
          selectedColors={selectedColors}
          presetPrefix="circuit"
        />
        
        {/* Strength Presets */}
        <PresetSection 
          title="Strength Presets" 
          presets={strengthPresets}
          selectedPreset={selectedStrengthPreset}
          onPresetClick={(preset) => handlePresetClick(preset, 'strength')}
          onColorSelect={handleColorSelect}
          selectedColors={selectedColors}
          presetPrefix="strength"
        />
      </View>
    </View>
  );
}

function PresetSection({ 
  title, 
  presets, 
  selectedPreset, 
  onPresetClick, 
  onColorSelect,
  selectedColors,
  presetPrefix
}: { 
  title: string; 
  presets: PresetButton[];
  selectedPreset: string | null;
  onPresetClick: (preset: string) => void;
  onColorSelect: (presetKey: string, color: typeof COLOR_PALETTE[0]) => void;
  selectedColors: { [key: string]: string };
  presetPrefix: string;
}) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: TOKENS.color.card,
      borderRadius: TOKENS.radius.card,
      borderWidth: 1,
      borderColor: TOKENS.color.borderGlass,
      padding: 32,
    }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: TOKENS.color.text, marginBottom: 14 }}>
        {title}
      </Text>
      
      <View style={{ gap: 10 }}>
        {presets.map((preset, index) => {
          const presetKey = `${presetPrefix}_${preset.label.toLowerCase().replace(' ', '_')}`;
          const isSelected = selectedPreset === preset.label;
          const selectedColor = selectedColors[presetKey];
          
          return (
            <View key={index}>
              <Pressable
                onPress={() => {
                  preset.onPress();
                  onPresetClick(preset.label);
                }}
                focusable
              >
                {({ focused }) => (
                  <View style={{
                    backgroundColor: focused ? preset.color : `${preset.color}99`,
                    borderRadius: TOKENS.radius.card,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderWidth: focused || isSelected ? 2 : 0,
                    borderColor: focused || isSelected ? TOKENS.color.accent : 'transparent',
                    transform: focused ? [{ translateY: -2 }, { scale: 1.05 }] : [],
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <Text style={{ color: TOKENS.color.text, fontSize: 14, fontWeight: '600' }}>
                      {preset.label}
                    </Text>
                    {selectedColor && (
                      <View style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: selectedColor,
                        borderWidth: 2,
                        borderColor: TOKENS.color.text,
                      }} />
                    )}
                  </View>
                )}
              </Pressable>
              
              {/* Color Palette Row */}
              {isSelected && (
                <View style={{ 
                  flexDirection: 'row', 
                  flexWrap: 'wrap',
                  gap: 7, 
                  marginTop: 10,
                  paddingLeft: 20,
                  paddingRight: 20,
                }}>
                  {COLOR_PALETTE.map((color, colorIndex) => {
                    const isColorSelected = selectedColors[presetKey] === color.value;
                    return (
                      <Pressable
                        key={colorIndex}
                        onPress={() => onColorSelect(presetKey, color)}
                        focusable
                      >
                        {({ focused }) => (
                          <View style={{
                            width: 41,
                            height: 41,
                            borderRadius: 20,
                            backgroundColor: color.value,
                            borderWidth: isColorSelected || focused ? 4 : 2,
                            borderColor: isColorSelected || focused ? TOKENS.color.text : 'rgba(255,255,255,0.2)',
                            transform: focused ? [{ scale: 1.1 }] : [],
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {isColorSelected && (
                              <View style={{
                                width: 14,
                                height: 14,
                                borderRadius: 7,
                                backgroundColor: TOKENS.color.text,
                              }} />
                            )}
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}