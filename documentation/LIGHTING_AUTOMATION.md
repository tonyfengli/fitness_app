# Lighting Automation Architecture

## Overview

This document outlines the architecture and implementation plan for integrating Philips Hue lighting automation into the fitness app. The system automatically changes lights based on workout timer events, enhancing the workout experience with visual feedback.

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
- Future-proof architecture to support Hue Entertainment API
- Minimal retry logic to avoid duplicate commands
- Server-side timer coordination for synchronized events
- Clean separation of lighting logic from transport layer

## Architecture Design

### System Components

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   TV App /      │     │  Timer           │     │  Lighting       │
│   Web Client    │────▶│  Coordinator     │────▶│  Service        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                          │
                                ▼                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  WebSocket       │     │  Philips Hue    │
                        │  Events          │     │  Bridge         │
                        └──────────────────┘     └─────────────────┘
```

### Package Structure

```
packages/api/src/
├── services/
│   ├── lighting/
│   │   ├── lighting-service.ts      # Main orchestrator
│   │   ├── hue-client.ts           # Hue API wrapper
│   │   ├── presets.ts              # Preset configurations
│   │   └── types.ts                # Shared types
│   └── timer-coordinator.ts        # Server-side timer
├── router/
│   └── lighting.ts                 # tRPC endpoints
```

## Implementation Details

### 1. Environment Configuration

```env
# Philips Hue Configuration
HUE_BRIDGE_IP=192.168.1.x        # Local IP of Hue Bridge
HUE_APP_KEY=your-app-key         # Generated via Hue API
HUE_GROUP_ID=1                   # Light group to control
HUE_ENABLED=true                 # Feature flag
```

### 2. Preset System

Presets are stored in a configuration file with per-template customization:

```typescript
// packages/api/src/services/lighting/presets.ts
export const LIGHTING_PRESETS = {
  circuit: {
    WORK: { 
      bri: 254,           // Max brightness
      hue: 47000,         // Blue
      sat: 200,           // High saturation
      transitiontime: 2   // 0.2s transition
    },
    REST: { 
      bri: 100,           // Dim
      hue: 25000,         // Green
      sat: 100,           // Medium saturation
      transitiontime: 2   // 0.2s transition
    }
  },
  strength: {
    ROUND_START: { 
      bri: 254, 
      hue: 47000, 
      sat: 200, 
      transitiontime: 10  // 1s smooth transition
    },
    ROUND_REST: { 
      bri: 120, 
      hue: 8000, 
      sat: 140, 
      transitiontime: 10 
    }
  }
};
```

**Future Enhancement**: Move to database storage with UI editor, using a provider interface for easy migration.

### 3. Timer Events

The system emits these events:

```typescript
// Circuit Events
'circuit:round:start'
'circuit:interval:work:start'  
'circuit:interval:rest:start'
'circuit:round:end'
'circuit:workout:complete'

// Strength Events
'strength:round:start'
'strength:round:rest:start'
'strength:round:end'
'strength:workout:complete'
```

### 4. Command Queue & Reliability

```typescript
class HueCommandQueue {
  // Single in-flight command to prevent flooding
  private inFlight: boolean = false;
  
  // Debounce duplicate commands within 300ms
  private isDuplicate(command): boolean;
  
  // Retry policy: 1 immediate retry with 200ms backoff
  // If fails, mark lighting "degraded" for 60s
}
```

### 5. Health Monitoring

- **Healthy State**: Light health check every 60s
- **Degraded State**: Check every 10s until recovery
- **Recovery**: Re-apply last intended state when connection restored
- **UI Indicator**: "Lighting offline" banner in TV app (bottom left)

### 6. API Endpoints

```typescript
// tRPC Router endpoints
lighting: {
  // GET /hue/lights - List available lights
  getLights: protectedProcedure.query(),
  
  // POST /hue/preset - Apply preset to group
  applyPreset: protectedProcedure
    .input(z.object({
      preset: z.string(),
      template: z.enum(['circuit', 'strength'])
    }))
    .mutation(),
  
  // POST /hue/state - Send custom state
  setState: protectedProcedure
    .input(z.object({
      state: z.object({
        bri: z.number(),
        hue: z.number(),
        sat: z.number()
      })
    }))
    .mutation(),
  
  // GET /hue/status - Check health
  getStatus: protectedProcedure.query()
}
```

## Implementation Plan

### Phase 1: Foundation (1-2 days)
1. Environment setup and validation
2. Create Hue client with basic API calls
3. Implement preset system with provider interface

### Phase 2: Core Services (2-3 days)
4. Build lighting service with command queue
5. Add tRPC router endpoints
6. Create lighting test page

### Phase 3: Timer Integration (3-4 days)
7. Implement server-side timer coordinator
8. Add WebSocket event emission
9. Connect to workout flows

### Phase 4: TV App Integration (1-2 days)
10. Add lighting status indicator
11. Test full workout flow
12. Verify non-blocking behavior

### Phase 5: Polish (1 day)
13. Error handling and logging
14. Documentation updates
15. Production readiness checks

**Total Timeline: 10-12 days**

## MVP Fast Path (3-4 days)

For quicker deployment:
1. Use client-side timer events (emit from React)
2. Hard-code presets (skip provider interface)
3. Simple queue without retry logic
4. Basic test page only
5. Refactor to full architecture in Phase 2

## Testing Strategy

### Development Testing
- Mock Hue client for unit tests
- Test page at `/lighting-test` with manual controls
- Simulate offline scenarios

### Integration Testing
```bash
# Test basic connectivity
curl -X GET "http://${HUE_BRIDGE_IP}/api/${HUE_APP_KEY}/lights"

# Test preset application
npm run test:lighting -- --preset=WORK

# Test failover behavior
# (Disconnect Hue Bridge and verify workout continues)
```

### Acceptance Criteria Verification
- [ ] Lights change within 1.5s of timer event
- [ ] Workout continues if Hue Bridge offline
- [ ] Status indicator shows connection state
- [ ] All presets apply correctly
- [ ] No duplicate commands sent

## Future Enhancements

### Phase 2 Features
- Multiple lighting zones support
- Per-session preset customization
- Database-stored presets with admin UI
- Advanced effects using Hue Entertainment API
- Integration with music/sound system

### Architecture Evolution
```
Current: HTTP API → Single Zone → File Presets
Future:  Entertainment API → Multi-Zone → DB Presets → Admin UI
```

## Troubleshooting

### Common Issues

**Issue**: Lights not changing
- Check `HUE_ENABLED=true` in environment
- Verify Bridge IP is correct and reachable
- Check app key permissions
- Look for "Lighting offline" indicator

**Issue**: Delayed light changes
- Check network latency to Bridge
- Verify no other apps controlling same lights
- Check server logs for queue backlog

**Issue**: Wrong colors/brightness
- Verify preset values are correct
- Check if lights support color (not just white)
- Ensure group ID is correct

### Debug Commands

```bash
# Check lighting service health
curl http://localhost:3000/api/trpc/lighting.getStatus

# Manually trigger preset
curl -X POST http://localhost:3000/api/trpc/lighting.applyPreset \
  -d '{"preset": "WORK", "template": "circuit"}'

# View current light state
curl http://localhost:3000/api/trpc/lighting.getLights
```

## Security Considerations

- Hue app key stored in environment variables only
- No external/cloud API access required
- All communication on local network
- Rate limiting to prevent light flooding
- Read-only access from client apps

## Performance Optimization

- Single group command per boundary (not per-light)
- Debounce duplicate commands (300ms window)
- Connection pooling for Hue HTTP client
- Pre-calculate next state during current phase
- Use appropriate transition times (0.2s circuit, 1s strength)

## Monitoring & Observability

```typescript
// Recommended metrics to track
- lighting.command.sent (counter)
- lighting.command.failed (counter)
- lighting.latency (histogram)
- lighting.queue.size (gauge)
- lighting.connection.status (gauge: 1=healthy, 0=degraded)
```

## References

- [Philips Hue API Documentation](https://developers.meethue.com/develop/hue-api-v2/)
- [Hue HTTP API v1 Reference](https://developers.meethue.com/develop/hue-api/lights-api/)
- Project Architecture: [APP_ARCHITECTURE.md](./APP_ARCHITECTURE.md)