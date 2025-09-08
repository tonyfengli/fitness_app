import React, { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '../App';
import { 
  setHueLights, 
  subscribeLightingStatus
} from '../lib/lighting';
import {
  DEFAULT_PRESET_COLORS,
  getHuePresetForColor,
  loadColorMappings,
  saveColorMappings,
} from '../lib/lighting/colorMappings';

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
    disabled: '#4b5563',
  },
  radius: {
    card: 16,
  },
};

// Hardcoded color palette
const COLOR_PALETTE = [
  { name: 'Red', value: '#ef4444', hue: 0 },
  { name: 'Orange', value: '#fb923c', hue: 8000 },
  { name: 'Yellow', value: '#eab308', hue: 10000 },
  { name: 'Green', value: '#22c55e', hue: 25000 },
  { name: 'Blue', value: '#3b82f6', hue: 45000 },
  { name: 'Purple', value: '#a855f7', hue: 50000 },
];

interface PresetButton {
  label: string;
  onPress: () => void;
  color: string;
  presetKey: string;
  disabled?: boolean;
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
    
    // Load saved color mappings
    loadColorMappings().then(mappings => {
      setSelectedColors(mappings);
    });
    
    return () => unsubscribe();
  }, []);

  const handlePresetClick = (preset: string, type: 'circuit' | 'strength', disabled?: boolean) => {
    if (disabled) return;
    
    if (type === 'circuit') {
      setSelectedCircuitPreset(selectedCircuitPreset === preset ? null : preset);
      setSelectedStrengthPreset(null);
    } else {
      setSelectedStrengthPreset(selectedStrengthPreset === preset ? null : preset);
      setSelectedCircuitPreset(null);
    }
  };

  const handleColorSelect = async (presetKey: string, color: typeof COLOR_PALETTE[0]) => {
    // Update local state
    const newMappings = { ...selectedColors, [presetKey]: color.value };
    setSelectedColors(newMappings);
    
    // Save to AsyncStorage
    await saveColorMappings(newMappings);
    
    // Apply color to test immediately
    const huePreset = getHuePresetForColor(color.value);
    await setHueLights(huePreset);
    
    // Collapse the color palette after selection
    setSelectedCircuitPreset(null);
    setSelectedStrengthPreset(null);
    
    console.log(`Color ${color.name} selected and saved for ${presetKey}`);
  };

  const handleBackPress = async () => {
    // Apply App Start color when going back
    const appStartColor = selectedColors['app_start'] || DEFAULT_PRESET_COLORS['app_start'];
    const huePreset = getHuePresetForColor(appStartColor);
    await setHueLights(huePreset);
    navigation.goBack();
  };

  const circuitPresets: PresetButton[] = [
    { 
      label: 'App Start', 
      onPress: async () => {
        const color = selectedColors['app_start'] || DEFAULT_PRESET_COLORS['app_start'];
        await setHueLights(getHuePresetForColor(color));
      },
      color: '#fb923c',
      presetKey: 'app_start'
    },
    { 
      label: 'Round Preview', 
      onPress: async () => {
        const color = selectedColors['circuit_round_preview'] || DEFAULT_PRESET_COLORS['circuit_round_preview'];
        await setHueLights(getHuePresetForColor(color));
      },
      color: '#a855f7',
      presetKey: 'circuit_round_preview'
    },
    { 
      label: 'Exercise Round', 
      onPress: async () => {
        const color = selectedColors['circuit_exercise_round'] || DEFAULT_PRESET_COLORS['circuit_exercise_round'];
        await setHueLights(getHuePresetForColor(color));
      },
      color: '#3b82f6',
      presetKey: 'circuit_exercise_round'
    },
    { 
      label: 'Rest', 
      onPress: async () => {
        const color = selectedColors['circuit_rest'] || DEFAULT_PRESET_COLORS['circuit_rest'];
        await setHueLights(getHuePresetForColor(color));
      },
      color: '#22c55e',
      presetKey: 'circuit_rest'
    },
    { 
      label: 'Cooldown', 
      onPress: async () => {
        const color = selectedColors['circuit_cooldown'] || DEFAULT_PRESET_COLORS['circuit_cooldown'];
        await setHueLights(getHuePresetForColor(color));
      },
      color: '#06b6d4',
      presetKey: 'circuit_cooldown',
      disabled: true
    },
  ];

  const strengthPresets: PresetButton[] = [
    { 
      label: 'App Start', 
      onPress: async () => {
        const color = selectedColors['app_start'] || DEFAULT_PRESET_COLORS['app_start'];
        await setHueLights(getHuePresetForColor(color));
      },
      color: '#fb923c',
      presetKey: 'app_start'
    },
    { 
      label: '0-5 Minutes', 
      onPress: async () => {
        const color = selectedColors['strength_0_5_min'] || DEFAULT_PRESET_COLORS['strength_0_5_min'];
        await setHueLights(getHuePresetForColor(color));
      },
      color: '#3b82f6',
      presetKey: 'strength_0_5_min'
    },
    { 
      label: '5-9 Minutes', 
      onPress: async () => {
        const color = selectedColors['strength_5_9_min'] || DEFAULT_PRESET_COLORS['strength_5_9_min'];
        await setHueLights(getHuePresetForColor(color));
      },
      color: '#a855f7',
      presetKey: 'strength_5_9_min'
    },
    { 
      label: '9-10 Minutes', 
      onPress: async () => {
        const color = selectedColors['strength_9_10_min'] || DEFAULT_PRESET_COLORS['strength_9_10_min'];
        await setHueLights(getHuePresetForColor(color));
      },
      color: '#ef4444',
      presetKey: 'strength_9_10_min'
    },
    { 
      label: 'Cooldown', 
      onPress: async () => {
        const color = selectedColors['strength_cooldown'] || DEFAULT_PRESET_COLORS['strength_cooldown'];
        await setHueLights(getHuePresetForColor(color));
      },
      color: '#06b6d4',
      presetKey: 'strength_cooldown'
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
            onPress={handleBackPress}
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
          onPresetClick={(preset, presetButton) => handlePresetClick(preset, 'circuit', presetButton.disabled)}
          onColorSelect={handleColorSelect}
          selectedColors={selectedColors}
        />
        
        {/* Strength Presets */}
        <PresetSection 
          title="Strength Presets" 
          presets={strengthPresets}
          selectedPreset={selectedStrengthPreset}
          onPresetClick={(preset) => handlePresetClick(preset, 'strength')}
          onColorSelect={handleColorSelect}
          selectedColors={selectedColors}
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
}: { 
  title: string; 
  presets: PresetButton[];
  selectedPreset: string | null;
  onPresetClick: (preset: string, presetButton: PresetButton) => void;
  onColorSelect: (presetKey: string, color: typeof COLOR_PALETTE[0]) => void;
  selectedColors: { [key: string]: string };
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
          const isSelected = selectedPreset === preset.label;
          const selectedColor = selectedColors[preset.presetKey] || 
                              (DEFAULT_PRESET_COLORS[preset.presetKey] || preset.color);
          
          return (
            <View key={index}>
              <Pressable
                onPress={() => {
                  if (!preset.disabled) {
                    preset.onPress();
                  }
                  onPresetClick(preset.label, preset);
                }}
                focusable
                disabled={preset.disabled}
              >
                {({ focused }) => (
                  <View style={{
                    backgroundColor: preset.disabled 
                      ? `${TOKENS.color.disabled}66` 
                      : focused 
                        ? preset.color 
                        : `${preset.color}99`,
                    borderRadius: TOKENS.radius.card,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderWidth: focused || isSelected ? 2 : 0,
                    borderColor: focused || isSelected ? TOKENS.color.accent : 'transparent',
                    transform: focused ? [{ translateY: -2 }, { scale: 1.05 }] : [],
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    opacity: preset.disabled ? 0.5 : 1,
                  }}>
                    <Text style={{ 
                      color: preset.disabled ? TOKENS.color.muted : TOKENS.color.text, 
                      fontSize: 14, 
                      fontWeight: '600' 
                    }}>
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
              {isSelected && !preset.disabled && (
                <View style={{ 
                  flexDirection: 'row', 
                  flexWrap: 'wrap',
                  gap: 7, 
                  marginTop: 10,
                  paddingLeft: 20,
                  paddingRight: 20,
                }}>
                  {COLOR_PALETTE.map((color, colorIndex) => {
                    const isColorSelected = selectedColors[preset.presetKey] === color.value;
                    return (
                      <Pressable
                        key={colorIndex}
                        onPress={() => onColorSelect(preset.presetKey, color)}
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