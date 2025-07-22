# Real-Time Check-in System Guide (Updated After SMS Refactor)

## Overview
The Real-Time Check-in System combines SMS messaging with live updates to create a seamless check-in experience for fitness clients. When clients text to check in, trainers see updates instantly in their session lobby through Server-Sent Events (SSE).

## Key Features
- 📱 SMS check-in via Twilio
- 🔄 Real-time updates via SSE
- 🤖 AI-powered intent detection with keyword fallbacks
- 💬 Message history tracking
- 🏋️ Session lifecycle management
- ⚡ Live session lobby updates
- 🎯 **UPDATED: Simplified preference collection flow (3 states instead of 6)**
- 🔧 **UPDATED: Unified SMS handler with context-aware routing**

## Architecture Overview

### System Flow (UPDATED)
```
┌─────────────┐     ┌──────────┐     ┌───────────────┐     ┌──────────────┐
│   Client    │────▶│  Twilio  │────▶│   Webhook     │────▶│   SSE        │
│   Phone     │ SMS │          │POST │  /api/sms/    │     │  Broadcast   │
└─────────────┘     └──────────┘     │   inbound     │     └──────┬───────┘
                                     └───────┬───────┘             │
                                             │                      ▼
                                             ▼              ┌──────────────┐
                                     ┌───────────────┐      │Session Lobby │
                                     │ SMSWebhook   │      │   (React)    │
                                     │   Handler    │      └──────────────┘
                                     └───────┬───────┘
                                             │
                          ┌──────────────────┴──────────────────┐
                          │                                     │
                    check_in intent                       preference flow
                          │                                     │
                          ▼                                     ▼
                 ┌─────────────────┐                   ┌──────────────┐
                 │  Check-in       │                   │ Preference   │
                 │  Handler        │                   │   Handler    │
                 └────────┬────────┘                   └──────────────┘
                          │
                          ├─────────────────┐
                          │                 │
                          ▼                 ▼
                 ┌─────────────────┐ ┌─────────────────┐
                 │ Database Updates│ │  SSE Broadcast  │
                 │ - User Session  │ │  to Session     │
                 │ - Check-in Record│ │    Lobby       │
                 │ - Message Log   │ └─────────────────┘
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  Send Response  │
                 │   via Twilio    │
                 └─────────────────┘
```

## Core Components (UPDATED)

### 1. SMS Webhook Handler (`/api/sms/inbound/route.ts`)
Handles incoming SMS messages from Twilio with improved routing:
- Validates Twilio webhook signatures
- Routes to appropriate handlers based on conversation state
- Handles disambiguation responses with dedicated handler
- Sends SMS responses asynchronously

### 2. Handler Architecture (NEW)
**Modular handler system**:
- `CheckInHandler` - Processes check-in requests
- `PreferenceHandler` - Handles initial preference collection
- `DisambiguationHandler` - Manages exercise selection
- `PreferenceUpdateHandler` - Processes preference updates in active mode
- `DefaultHandler` - Fallback for unrecognized messages

### 3. Conversation State Service (ENHANCED)
Extended to support multiple conversation types:
```typescript
export type ConversationType = 
  | "include_exercise"      // Exercise disambiguation
  | "preference_followup"   // Asking for missing preference fields
  | "preference_collection" // General preference collection state
```

### 4. Check-in Service (`src/services/checkInService.ts`)
Core business logic for processing check-ins (unchanged):
- Phone number normalization
- User and session lookup
- Check-in record creation
- Real-time event broadcasting

### 5. Message Service (`src/services/messageService.ts`)
Tracks all SMS interactions (unchanged):
- Saves inbound/outbound messages
- Stores metadata (intent, check-in results)
- Provides message history for trainers

### 6. Real-time Updates (SSE) - ENHANCED
Server-Sent Events with improved timeout handling:

#### Backend (`/api/sse/check-ins/route.ts`)
```typescript
// Added 2-minute timeout for connections
// Better cleanup on request abort
// Improved error handling
```

#### Frontend Hook (`useCheckInStream.ts`)
```typescript
// Added 10-second connection timeout
// Reduced reconnection attempts from 5 to 3
// Better cleanup on unmount
```

## Intent Detection System (Unchanged)

### Three-Layer Detection Strategy

1. **Keyword Detection (Fast Path)**
```typescript
CHECK_IN_KEYWORDS = [
  "here", "im here", "i'm here", "i am here",
  "ready", "im ready", "i'm ready", "i am ready",
  "checking in", "check in", "checkin",
  "arrived", "im in", "i'm in", "i am in",
  "present", "at the gym", "at gym"
]
```

2. **AI Detection (Smart Path)** - Currently disabled
3. **Fallback Chain** - Defaults to keyword detection

## Database Schema (Unchanged)

Key tables remain the same with conversation_state table used more extensively for tracking various conversation types.

## Preference Collection Flow (MAJORLY SIMPLIFIED)

### NEW: Simplified State Machine (3 States)

```
NOT_STARTED → COLLECTING → ACTIVE
```

### State Definitions (UPDATED)

1. **`NOT_STARTED`**: User checked in, no preferences yet
2. **`COLLECTING`**: Actively collecting preferences (includes disambiguation)
3. **`ACTIVE`**: Preferences collected, accepting updates only

### Key Changes from Original Design

**Removed States**:
- ❌ `initial_collected` - Merged into COLLECTING
- ❌ `disambiguation_pending` - Handled within COLLECTING
- ❌ `disambiguation_clarifying` - Handled within COLLECTING
- ❌ `disambiguation_resolved` - Handled within COLLECTING
- ❌ `followup_sent` - Handled within COLLECTING
- ❌ `preferences_active` - Renamed to ACTIVE

### Complete Flow Examples (UPDATED)

#### Path 1: Simple preferences (no exercises)
```
User: "Feeling good, medium intensity"
Bot: "Got it! What's your training focus today - strength, endurance, or stability? Also, any specific areas you want to work on?"
State: NOT_STARTED → COLLECTING

User: "Strength focus, work on upper body"
Bot: "Perfect! I've saved your preferences. You can update them anytime before your session starts."
State: COLLECTING → ACTIVE

User: "Actually, let's do endurance"
Bot: "Updated to endurance focus. Let me know if you need any other changes."
State: (remains in ACTIVE)
```

#### Path 2: With disambiguation (UPDATED)
```
User: "I want to do presses today"
Bot: "I found multiple exercises matching 'presses'. Please select by number:
     1. Barbell Bench Press
     2. Dumbbell Shoulder Press
     3. Incline Dumbbell Press
     ..."
State: NOT_STARTED → COLLECTING (with pending disambiguation)

User: "1 and 3"
Bot: "Perfect! I'll include Barbell Bench Press and Incline Dumbbell Press. What's your training focus today - strength, endurance, or stability?"
State: COLLECTING (disambiguation resolved, asking followup)

User: "Strength"
Bot: "Perfect! I've saved your preferences. You can update them anytime before your session starts."
State: COLLECTING → ACTIVE
```

#### Path 3: Session goal fix (NEW)
```
User: "Let's make this a strength session"
Bot: "Got it! I've set your session focus to strength. What specific areas are you looking to target today?"
State: NOT_STARTED → COLLECTING (sessionGoal extracted, NOT triggering 69 exercises)

User: "Focus on back and shoulders"
Bot: "Perfect! I've saved your preferences. You can update them anytime before your session starts."
State: COLLECTING → ACTIVE
```

### Key Business Rules (UPDATED)

1. **Targeted follow-up priorities** (unchanged):
   - Always ask for `sessionGoal` if not set
   - Then pick 1 other missing field
   - Priority: muscleTargets → avoidJoints/muscleLessens → includeExercises → avoidExercises

2. **Disambiguation rules** (simplified):
   - Only triggered for "include exercises" (not exclude)
   - Shows ALL matching options (no truncation)
   - Handled by DisambiguationHandler
   - Single clarification attempt before moving on

3. **Active mode behavior** (simplified):
   - All handled by PreferenceUpdateHandler
   - Updates existing fields (not append)
   - Continues indefinitely until session starts
   - **NEW**: Prevents session goal phrases from triggering exercise disambiguation

4. **Context-aware routing** (NEW):
   - Single entry point checks conversation state
   - Routes to appropriate handler based on context
   - No more complex state checking in individual handlers

### Preference Update Parser Enhancement (NEW)

Fixed issue where "Let's make this a strength session" would trigger exercise disambiguation:

```typescript
// Skip exercise parsing if this is purely a session goal update
const isSessionGoalOnly = goalUpdate !== undefined && 
  /\b(make\s+(this|it)\s+a?\s+(strength|stability|endurance)\s+session|focus\s+on\s+(strength|stability|endurance))\b/i.test(lowerMessage);
```

## Exercise Matching System (Unchanged)

The hybrid exercise matching system remains the same with:
- Exercise type matching
- Deterministic patterns
- LLM fallback for fuzzy matches

## Response Messages (Updated)

| Scenario | Message | Handler |
|----------|---------|---------|
| ✅ Successful check-in | "Hello [Name]! You're checked in for the session. Welcome!\n\nHow are you feeling today? Is there anything I should know before building your workout?" | CheckInHandler |
| 🎯 Preference Collection | Various targeted follow-up questions | PreferenceHandler |
| 🔢 Disambiguation | Exercise selection lists | DisambiguationHandler |
| 🔄 Preference Updates | "Updated [field]. Let me know if you need any other changes." | PreferenceUpdateHandler |
| ℹ️ Non check-in message | Context-aware response | DefaultHandler |

## Testing (To Be Updated)

The test suite needs updates to reflect:
- New handler architecture
- Simplified state machine
- Context-aware routing
- Session goal disambiguation fix

## Configuration (Unchanged)

Environment variables and Twilio webhook setup remain the same.

## Security Features (Unchanged)

All security features remain in place.

## Session Test Data Logging (Enhanced)

Now captures more detailed information about:
- Handler routing decisions
- Conversation state transitions
- Disambiguation attempts and resolutions
- Session goal vs exercise parsing

## Performance Improvements

1. **SSE Connection Management**:
   - 2-minute timeout prevents hanging connections
   - Better cleanup reduces server load
   - Reduced reconnection attempts

2. **Simplified State Machine**:
   - Fewer state transitions
   - Less database queries
   - Clearer flow reduces processing time

3. **Context-Aware Routing**:
   - Single decision point for routing
   - No redundant state checks
   - Faster message processing

## Migration Notes

When updating from the old 6-state system to the new 3-state system:

1. **State Mapping**:
   - `not_started` → `NOT_STARTED`
   - `initial_collected`, `disambiguation_*`, `followup_sent` → `COLLECTING`
   - `preferences_active` → `ACTIVE`

2. **Handler Updates**:
   - All SMS handling now goes through SMSWebhookHandler
   - Individual handlers focus on their specific logic
   - No more complex state management in handlers

3. **Database Considerations**:
   - conversation_state table now supports multiple types
   - preferenceCollectionStep uses simplified states
   - Existing data remains compatible

## Future Improvements

1. **Rate Limiting**: Implement per-phone number rate limits
2. **Message Templates**: Centralize response messages
3. **Analytics**: Track conversation success rates
4. **A/B Testing**: Test different follow-up strategies
5. **Multi-language Support**: Support Spanish and other languages

## Troubleshooting Checklist (Updated)

- [ ] Verify handler routing is working correctly
- [ ] Check conversation state is being tracked
- [ ] Confirm SSE timeout is set to 2 minutes
- [ ] Test session goal phrases don't trigger exercise disambiguation
- [ ] Verify preference updates work in ACTIVE state
- [ ] Monitor handler performance metrics
- [ ] Check for any hanging SSE connections
- [ ] Verify all handlers are properly imported