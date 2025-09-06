# Lighting Automation Architecture

## Overview

This document outlines the architecture and implementation for integrating Philips Hue lighting automation into the fitness app. The system automatically changes lights based on workout timer events, enhancing the workout experience with visual feedback.

## Requirements

### Core Features
- **Automated Light Control**: Lights change automatically at workout phase boundaries
- **Two Workout Types Support**:
  - **Strength**: Rounds of 10 minutes → change lights at `round_start`
  - **Circuit**: Work/rest intervals → change lights at `interval_work_start` and `interval_rest_start`
- **Non-blocking Operation**: If Hue Bridge is unreachable, workouts continue without interruption
- **Session-wide Control**: Lighting changes apply to the entire training session
- **Performance Target**: Light changes within 1.5 seconds of timer events

### Technical Requirements
- Local LAN control via Philips Hue HTTP v1 API (no cloud dependency)
- Direct TV app to Hue Bridge communication (no gateway required)
- Minimal retry logic to avoid duplicate commands
- Client-side timer drives lighting events
- Clean separation of lighting logic from workout logic
- Automatic recovery when Hue Bridge comes back online

## Architecture Design

### System Components (Finalized)

```
┌─────────────────┐     Direct HTTP     ┌─────────────────┐
│   TV App        │───────────────────▶│  Philips Hue    │
│ (React Native)  │    192.168.x.x      │  Bridge         │
└─────────────────┘                     └─────────────────┘
        │
        │ Optional telemetry
        ▼
┌─────────────────┐
│  Cloud API      │
│  (Analytics)    │
└─────────────────┘
```

### Package Structure

```
apps/tv/src/
├── lib/
│   ├── lighting/
│   │   ├── hue-direct.ts    # Direct Hue API client
│   │   ├── presets.ts       # Lighting presets
│   │   └── index.ts         # Public API
│   └── ...
├── components/
│   └── LightingStatusDot.tsx # Status indicator
└── screens/
    ├── CircuitWorkoutLiveScreen.tsx
    └── WorkoutLiveScreen.tsx
```

## Implementation Details

### 1. Environment Configuration

```env
# TV App Environment (.env)
EXPO_PUBLIC_HUE_BRIDGE_IP=192.168.8.192
EXPO_PUBLIC_HUE_APP_KEY=your-app-key
EXPO_PUBLIC_HUE_GROUP_ID=0  # 0 = all lights

# API Environment (for test page)
HUE_BRIDGE_IP=192.168.8.192
HUE_APP_KEY=your-app-key
HUE_GROUP_ID=0
HUE_ENABLED=true
```

### 2. Preset System

Presets are hardcoded in the TV app for reliability:

```typescript
// apps/tv/src/lib/lighting/presets.ts
export const LIGHTING_PRESETS = {
  circuit: {
    WARMUP: { bri: 150, hue: 8000, sat: 100, transitiontime: 20 },
    WORK: { bri: 254, hue: 47000, sat: 200, transitiontime: 2 },
    REST: { bri: 100, hue: 25000, sat: 100, transitiontime: 2 },
    ROUND: { bri: 200, hue: 10000, sat: 140, transitiontime: 5 },
    COOLDOWN: { bri: 120, hue: 35000, sat: 80, transitiontime: 20 },
    DEFAULT: { bri: 180, hue: 8000, sat: 140, transitiontime: 10 }
  },
  strength: {
    WARMUP: { bri: 150, hue: 8000, sat: 100, transitiontime: 20 },
    ROUND_START: { bri: 254, hue: 47000, sat: 200, transitiontime: 10 },
    ROUND_REST: { bri: 120, hue: 8000, sat: 140, transitiontime: 10 },
    COOLDOWN: { bri: 120, hue: 35000, sat: 80, transitiontime: 20 },
    DEFAULT: { bri: 180, hue: 8000, sat: 140, transitiontime: 10 }
  }
};
```

### 3. Timer Events

The TV app's local timer triggers these lighting changes:

```typescript
// Circuit workout phases
'warmup' → WARMUP preset
'work' → WORK preset
'rest' → REST preset
'round_start' → ROUND preset (on new rounds)
'cooldown' → COOLDOWN preset
'complete' → DEFAULT preset

// Strength workout phases
'warmup' → WARMUP preset
'work' → ROUND_START preset
'rest' → ROUND_REST preset
'cooldown' → COOLDOWN preset
'complete' → DEFAULT preset
```

### 4. Reliability Features

```typescript
// Deduplication
- 300ms window to prevent duplicate commands
- Track last applied preset

// Health monitoring
- Check Hue Bridge health every 10s
- Visual status indicator (green/yellow/red dot)
- Automatic recovery with state reapplication

// Error handling
- 2s timeout on Hue API calls
- Workout continues if lighting fails
- Fire-and-forget approach for non-blocking
```

### 5. Recovery Logic

When Hue Bridge comes back online after an outage:
- Last applied preset is automatically reapplied
- State persisted in AsyncStorage for app restarts
- Single retry to avoid flooding

## Implementation Plan

### Phase 1: Foundation ✅ (Complete)
1. ✅ Environment setup and validation
2. ✅ Create Hue client with basic API calls
3. ✅ Implement preset system

### Phase 2: Core Services ✅ (Complete)
4. ✅ Build lighting service with command queue
5. ✅ Add tRPC router endpoints
6. ✅ Create lighting test page

### Phase 3: Direct TV Integration (1-2 days) 🚧 Current
7. Copy lighting logic to TV app
8. Add direct Hue API calls from TV
9. Connect to workout timer events
10. Add status indicator component
11. Test recovery scenarios

### Phase 4: Polish & Testing (1 day)
12. Error handling refinement
13. Performance optimization
14. Full workout flow testing
15. Documentation updates

**Total Timeline: 5-6 days** (vs original 10-12 days)

## Testing Strategy

### Development Testing
- Configuration page at `/lighting-configuration` for testing and configuration
- Use actual Hue Bridge (no mocks needed)
- Test network disconnection scenarios

### Integration Testing
```bash
# Test from TV device
adb shell ping 192.168.8.192  # Verify bridge reachable

# Monitor logs during workout
adb logcat | grep -E "(Hue|Lighting)"

# Test recovery
# 1. Start workout
# 2. Unplug Hue Bridge
# 3. Verify red status dot
# 4. Plug back in
# 5. Verify next phase change works
```

### Acceptance Criteria
- ✅ Lights change within 1.5s of timer event
- ✅ Workout continues if Hue Bridge offline
- ✅ Status indicator shows connection state
- ✅ All presets apply correctly
- ✅ No duplicate commands sent
- ✅ Recovery applies last state when bridge returns

## Future Enhancements

### Phase 5: Multi-Device Sync (Optional)
If multiple devices need to control lights:
- Add lightweight gateway service
- WebSocket for real-time sync
- Centralized state management

### Phase 6: Advanced Features
- Multiple lighting zones support
- Per-session preset customization
- Database-stored presets with admin UI
- Hue Entertainment API for effects
- Integration with music/sound system
- Time-of-day adjustments
- User preference profiles

### Architecture Evolution
```
Current: TV App → Direct HTTP → Single Zone → Hardcoded Presets
Future:  Multi-Device → Gateway → Multi-Zone → DB Presets → Admin UI
```

## Troubleshooting

### Common Issues

**Issue**: Lights not changing
- Check TV app env: `EXPO_PUBLIC_HUE_BRIDGE_IP` is correct
- Verify Bridge is on same network as TV
- Check app key has correct permissions
- Look for red status dot indicator

**Issue**: Delayed light changes
- Check network latency between TV and Bridge
- Verify no other apps controlling same lights
- Status dot yellow = slow (>1.5s)

**Issue**: Wrong colors/brightness
- Verify preset values in code
- Check if lights support color (not just white bulbs)
- Ensure group ID is correct (0 = all lights)

### Debug Tools

From TV device:
```bash
# Check network connectivity
adb shell ping 192.168.8.192

# View app logs
adb logcat | grep "Hue"

# Test Hue API directly
adb shell curl -X GET "http://192.168.8.192/api/[APP_KEY]/config"
```

## Security Considerations

- Hue credentials stored in TV app (local network only)
- No cloud dependency for lighting control
- Bridge only accessible on LAN
- Rate limiting via deduplication
- Optional cloud telemetry is fire-and-forget

## Performance Optimization

- Direct HTTP calls (no middleware)
- Single group command per phase change
- Debounce duplicate commands (300ms)
- Async/non-blocking implementation
- Appropriate transition times (0.2s circuit, 1s strength)
- Health check caching (5s)

## Monitoring & Observability

### Local (TV App)
- Status dot color indicates health
- Console logs for debugging
- AsyncStorage for state persistence

### Optional Cloud Telemetry
```typescript
// Fire-and-forget event logging
{
  sessionId: string,
  event: string,
  success: boolean,
  latency: number,
  timestamp: number
}
```

## Migration Path

If you need to move from direct control to gateway-based:

1. **Extract lighting library** from TV app
2. **Create gateway service** using existing code
3. **Update TV app** to call gateway instead of Hue
4. **Add WebSocket** for multi-device sync
5. **No changes** to presets or timing logic

The direct approach doesn't lock you in - all code is reusable.

## References

- [Philips Hue API Documentation](https://developers.meethue.com/develop/hue-api-v2/)
- [Hue HTTP API v1 Reference](https://developers.meethue.com/develop/hue-api/lights-api/)
- [React Native Networking](https://reactnative.dev/docs/network)
- Project Architecture: [APP_ARCHITECTURE.md](./APP_ARCHITECTURE.md)