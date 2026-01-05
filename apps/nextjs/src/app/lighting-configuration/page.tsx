"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { DEFAULT_PRESETS } from "@acme/api/services/lighting/presets";

type PresetName = 'WARMUP' | 'WORK' | 'REST' | 'COOLDOWN' | 'DEFAULT' | 'ROUND_START' | 'ROUND_REST';
type Template = 'circuit' | 'strength';

interface PresetButton {
  name: PresetName;
  label: string;
  template: Template;
  color: string;
}

const CIRCUIT_PRESETS: PresetButton[] = [
  { name: 'WARMUP', label: 'Warmup', template: 'circuit', color: 'bg-orange-500' },
  { name: 'WORK', label: 'Work', template: 'circuit', color: 'bg-blue-500' },
  { name: 'REST', label: 'Rest', template: 'circuit', color: 'bg-green-500' },
  { name: 'COOLDOWN', label: 'Cooldown', template: 'circuit', color: 'bg-amber-600' },
  { name: 'DEFAULT', label: 'Default', template: 'circuit', color: 'bg-gray-500' },
];

const STRENGTH_PRESETS: PresetButton[] = [
  { name: 'WARMUP', label: 'Warmup', template: 'strength', color: 'bg-orange-500' },
  { name: 'ROUND_START', label: 'Round Start', template: 'strength', color: 'bg-blue-500' },
  { name: 'ROUND_REST', label: 'Round Rest', template: 'strength', color: 'bg-orange-400' },
  { name: 'COOLDOWN', label: 'Cooldown', template: 'strength', color: 'bg-amber-600' },
  { name: 'DEFAULT', label: 'Default', template: 'strength', color: 'bg-gray-500' },
];

export default function LightingConfigurationPage() {
  const trpc = useTRPC();
  const [customState, setCustomState] = useState({
    on: true,
    bri: 254,
    hue: 0,
    sat: 254,
    transitiontime: 10,
  });
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);

  // Queries
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = 
    useQuery({
      ...trpc.lighting.getStatus.queryOptions(),
      refetchInterval: 5000, // Poll every 5 seconds
    });

  const { data: lights, isLoading: lightsLoading } = 
    useQuery({
      ...trpc.lighting.getLights.queryOptions(),
      enabled: status?.status === 'connected',
    });

  // Mutations
  const applyPreset = useMutation(
    trpc.lighting.applyPreset.mutationOptions({
      onSuccess: () => {
        // Could show a success toast here
      },
      onError: (error) => {
        alert(`Failed to apply preset: ${error.message}`);
      },
    })
  );

  const setState = useMutation(
    trpc.lighting.setState.mutationOptions({
      onSuccess: () => {
        // Could show a success toast here
      },
      onError: (error) => {
        alert(`Failed to set state: ${error.message}`);
      },
    })
  );

  const initialize = useMutation(
    trpc.lighting.initialize.mutationOptions({
      onSuccess: () => {
        refetchStatus();
      },
      onError: (error) => {
        alert(`Failed to initialize: ${error.message}`);
      },
    })
  );

  const reportEvent = useMutation(
    trpc.lighting.reportTimerEvent.mutationOptions({
      onSuccess: () => {
        // Could show a success toast here
      },
      onError: (error) => {
        alert(`Failed to report event: ${error.message}`);
      },
    })
  );

  const startAnimation = useMutation(
    trpc.lighting.startAnimation.mutationOptions({
      onSuccess: (data, variables) => {
        console.log('[LIGHTING-CONFIG] Animation started successfully:', data);
        setCurrentAnimation(variables.animation);
      },
      onError: (error) => {
        console.error('[LIGHTING-CONFIG] Failed to start animation:', error);
        alert(`Failed to start animation: ${error.message}`);
      },
    })
  );

  const stopAnimation = useMutation(
    trpc.lighting.stopAnimation.mutationOptions({
      onSuccess: (data) => {
        console.log('[LIGHTING-CONFIG] Animation stopped successfully:', data);
        setCurrentAnimation(null);
      },
      onError: (error) => {
        console.error('[LIGHTING-CONFIG] Failed to stop animation:', error);
        alert(`Failed to stop animation: ${error.message}`);
      },
    })
  );

  // Initialize on mount
  useEffect(() => {
    initialize.mutate();
  }, []);

  const handlePresetClick = (preset: PresetButton) => {
    applyPreset.mutate({
      preset: preset.name,
      template: preset.template,
    });
  };

  const handleCustomStateApply = () => {
    setState.mutate({ state: customState });
  };

  const simulateWorkoutEvent = (event: string) => {
    reportEvent.mutate({
      sessionId: 'test-session-' + Date.now(),
      event: event as any,
      metadata: {
        round: 1,
        totalRounds: 3,
        clientCount: 4,
      },
    });
  };

  if (statusLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading lighting system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Lighting Configuration</h1>

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Connection Status</p>
              <p className="font-medium">
                <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                  status?.status === 'connected' ? 'bg-green-500' :
                  status?.status === 'degraded' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}></span>
                {status?.status || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Bridge Info</p>
              <p className="font-medium">
                {status?.bridgeInfo?.name || 'Not connected'}
              </p>
            </div>
            {status?.lastError && (
              <div className="col-span-2">
                <p className="text-sm text-gray-600">Last Error</p>
                <p className="text-red-600 text-sm">{status.lastError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Custom State Control */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Custom State Control</h2>
          
          {/* Presets Dropdown */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Presets</label>
            <select
              className="w-full md:w-1/2 border rounded px-3 py-2"
              onChange={(e) => {
                const [template, presetName] = e.target.value.split(':');
                if (template && presetName) {
                  if (template === 'other') {
                    // Handle special animation presets
                    switch (presetName) {
                      case 'DRIFT':
                        setCustomState({
                          on: true,
                          bri: 254,
                          hue: 47000,
                          sat: 200,
                          transitiontime: 20,
                        });
                        break;
                      case 'BREATHE':
                        setCustomState({
                          on: true,
                          bri: 100,
                          hue: 25000,
                          sat: 100,
                          transitiontime: 10,
                        });
                        break;
                      case 'FLASH':
                        setCustomState({
                          on: true,
                          bri: 200,
                          hue: 10000,
                          sat: 140,
                          transitiontime: 2,
                        });
                        break;
                      case 'COUNTDOWN':
                        setCustomState({
                          on: true,
                          bri: 240,
                          hue: 47000,
                          sat: 200,
                          transitiontime: 2,
                        });
                        break;
                      case 'PAUSE':
                        setCustomState({
                          on: true,
                          bri: 120,
                          hue: 8000,
                          sat: 80,
                          transitiontime: 10,
                        });
                        break;
                    }
                  } else {
                    // Handle circuit/strength presets
                    const preset = template === 'circuit' 
                      ? DEFAULT_PRESETS.circuit[presetName as keyof typeof DEFAULT_PRESETS.circuit]
                      : DEFAULT_PRESETS.strength[presetName as keyof typeof DEFAULT_PRESETS.strength];
                    
                    if (preset) {
                      setCustomState({
                        on: true,
                        bri: preset.bri,
                        hue: preset.hue,
                        sat: preset.sat,
                        transitiontime: preset.transitiontime || 10,
                      });
                    }
                  }
                }
              }}
              defaultValue=""
            >
              <option value="">Select a preset...</option>
              <optgroup label="Circuit Presets">
                <option value="circuit:WARMUP">Circuit - Warmup (Orange)</option>
                <option value="circuit:WORK">Circuit - Work (Purple)</option>
                <option value="circuit:REST">Circuit - Rest (Green)</option>
                <option value="circuit:ROUND">Circuit - Round (Orange)</option>
                <option value="circuit:COOLDOWN">Circuit - Cooldown (Blue)</option>
                <option value="circuit:DEFAULT">Circuit - Default (Orange)</option>
              </optgroup>
              <optgroup label="Strength Presets">
                <option value="strength:WARMUP">Strength - Warmup (Orange)</option>
                <option value="strength:ROUND_START">Strength - Round Start (Purple)</option>
                <option value="strength:ROUND_REST">Strength - Round Rest (Orange)</option>
                <option value="strength:COOLDOWN">Strength - Cooldown (Blue)</option>
                <option value="strength:DEFAULT">Strength - Default (Orange)</option>
              </optgroup>
              <optgroup label="Other">
                <option value="other:DRIFT">Drift (Work Animation)</option>
                <option value="other:BREATHE">Breathe (Rest Animation)</option>
                <option value="other:FLASH">Round Flash</option>
                <option value="other:COUNTDOWN">Countdown Pulse</option>
                <option value="other:PAUSE">Pause State</option>
              </optgroup>
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">On/Off</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={customState.on ? 'on' : 'off'}
                onChange={(e) => setCustomState({...customState, on: e.target.value === 'on'})}
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Brightness (1-254)</label>
              <input
                type="range"
                min="1"
                max="254"
                value={customState.bri}
                onChange={(e) => setCustomState({...customState, bri: parseInt(e.target.value)})}
                className="w-full"
              />
              <span className="text-sm text-gray-600">{customState.bri}</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hue (0-65535)</label>
              <input
                type="range"
                min="0"
                max="65535"
                value={customState.hue}
                onChange={(e) => setCustomState({...customState, hue: parseInt(e.target.value)})}
                className="w-full"
              />
              <span className="text-sm text-gray-600">{customState.hue}</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Saturation (0-254)</label>
              <input
                type="range"
                min="0"
                max="254"
                value={customState.sat}
                onChange={(e) => setCustomState({...customState, sat: parseInt(e.target.value)})}
                className="w-full"
              />
              <span className="text-sm text-gray-600">{customState.sat}</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Transition (deciseconds)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={customState.transitiontime}
                onChange={(e) => setCustomState({...customState, transitiontime: parseInt(e.target.value) || 0})}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          <button
            onClick={handleCustomStateApply}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            disabled={setState.isPending}
          >
            Apply Custom State
          </button>
          
          {/* Animation Controls */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-600">Animation Controls</p>
              {currentAnimation && (
                <p className="text-sm font-medium text-green-600 flex items-center">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>
                  {currentAnimation} animation running
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  console.log('[LIGHTING-CONFIG] Starting drift animation...');
                  startAnimation.mutate({ animation: 'drift' });
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                disabled={startAnimation.isPending}
              >
                Start Drift
              </button>
              <button
                onClick={() => {
                  console.log('[LIGHTING-CONFIG] Starting breathe animation...');
                  startAnimation.mutate({ animation: 'breathe' });
                }}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                disabled={startAnimation.isPending}
              >
                Start Breathe
              </button>
              <button
                onClick={() => {
                  console.log('[LIGHTING-CONFIG] Starting countdown animation...');
                  startAnimation.mutate({ animation: 'countdown' });
                }}
                className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
                disabled={startAnimation.isPending}
              >
                Start Countdown
              </button>
              <button
                onClick={() => {
                  console.log('[LIGHTING-CONFIG] Stopping animation...');
                  stopAnimation.mutate();
                }}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                disabled={stopAnimation.isPending}
              >
                Stop Animation
              </button>
            </div>
          </div>
        </div>

        {/* Lights List */}
        {lights && lights.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Available Lights</h2>
            <div className="space-y-2">
              {lights.map((light) => (
                <div key={light.id} className="flex items-center justify-between py-2 border-b">
                  <span className="font-medium">{light.name}</span>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm ${light.reachable ? 'text-green-600' : 'text-red-600'}`}>
                      {light.reachable ? 'Reachable' : 'Unreachable'}
                    </span>
                    <span className="text-sm text-gray-600">
                      {light.on ? 'On' : 'Off'} • Brightness: {light.brightness}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preset Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Circuit Presets */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Circuit Presets</h2>
            <div className="grid grid-cols-2 gap-4">
              {CIRCUIT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePresetClick(preset)}
                  className={`${preset.color} text-white px-4 py-2 rounded hover:opacity-90 transition-opacity`}
                  disabled={applyPreset.isPending}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Strength Presets */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Strength Presets</h2>
            <div className="grid grid-cols-2 gap-4">
              {STRENGTH_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePresetClick(preset)}
                  className={`${preset.color} text-white px-4 py-2 rounded hover:opacity-90 transition-opacity`}
                  disabled={applyPreset.isPending}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Event Simulation */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Simulate Workout Events</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => simulateWorkoutEvent('circuit:interval:work:start')}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              disabled={reportEvent.isPending}
            >
              Circuit: Work Start
            </button>
            <button
              onClick={() => simulateWorkoutEvent('circuit:interval:rest:start')}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              disabled={reportEvent.isPending}
            >
              Circuit: Rest Start
            </button>
            <button
              onClick={() => simulateWorkoutEvent('strength:round:start')}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
              disabled={reportEvent.isPending}
            >
              Strength: Round Start
            </button>
            <button
              onClick={() => simulateWorkoutEvent('strength:round:rest:start')}
              className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
              disabled={reportEvent.isPending}
            >
              Strength: Rest Start
            </button>
          </div>
        </div>

        {/* Re-initialize Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => initialize.mutate()}
            className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
            disabled={initialize.isPending}
          >
            Re-initialize Lighting System
          </button>
        </div>
      </div>
    </div>
  );
}