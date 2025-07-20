# Real-Time Check-in System Guide

## Overview
The Real-Time Check-in System combines SMS messaging with live updates to create a seamless check-in experience for fitness clients. When clients text to check in, trainers see updates instantly in their session lobby through Server-Sent Events (SSE).

## Key Features
- 📱 SMS check-in via Twilio
- 🔄 Real-time updates via SSE/WebSockets
- 🤖 AI-powered intent detection with keyword fallbacks
- 💬 Message history tracking
- 🏋️ Session lifecycle management
- ⚡ Live session lobby updates

## Architecture Overview

### System Flow
```
┌─────────────┐     ┌──────────┐     ┌───────────────┐     ┌──────────────┐
│   Client    │────▶│  Twilio  │────▶│   Webhook     │────▶│   SSE        │
│   Phone     │ SMS │          │POST │  /api/sms/    │     │  Broadcast   │
└─────────────┘     └──────────┘     │   inbound     │     └──────┬───────┘
                                     └───────┬───────┘             │
                                             │                      ▼
                                             ▼              ┌──────────────┐
                                     ┌───────────────┐      │Session Lobby │
                                     │ Parse Intent  │      │   (React)    │
                                     │  (LangGraph)  │      └──────────────┘
                                     └───────┬───────┘
                                             │
                          ┌──────────────────┴──────────────────┐
                          │                                     │
                    check_in intent                       other intent
                          │                                     │
                          ▼                                     ▼
                 ┌─────────────────┐                   ┌──────────────┐
                 │  Check-in       │                   │ Send Generic │
                 │  Service        │                   │   Response   │
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

## Core Components

### 1. SMS Webhook Handler (`/api/sms/inbound/route.ts`)
Handles incoming SMS messages from Twilio:
- Validates Twilio webhook signatures
- Parses message intent using AI/keywords
- Routes to appropriate handlers
- Sends SMS responses

### 2. Check-in Service (`src/services/checkInService.ts`)
Core business logic for processing check-ins:
- Phone number normalization
- User and session lookup
- Check-in record creation
- Real-time event broadcasting

Key functions:
```typescript
processCheckIn(phoneNumber: string): Promise<CheckInResult>
getUserByPhone(phoneNumber: string): Promise<{userId, businessId, trainingSessionId?} | null>
setBroadcastFunction(fn: BroadcastFunction): void
```

### 3. Message Service (`src/services/messageService.ts`)
Tracks all SMS interactions:
- Saves inbound/outbound messages
- Stores metadata (intent, check-in results)
- Provides message history for trainers

### 4. Real-time Updates (SSE)
Server-Sent Events for live updates:

#### Backend (`/api/sse/check-ins/route.ts`)
```typescript
// SSE endpoint that clients connect to
GET /api/sse/check-ins?sessionId=xxx

// Broadcasts check-in events to connected clients
broadcastCheckInEvent(sessionId, {userId, name, checkedInAt})
```

#### Frontend Hook (`useCheckInStream.ts`)
```typescript
const { checkedInUsers, connectionState } = useCheckInStream(sessionId);
// Handles reconnection, error recovery, and state management
```

### 5. Session Lobby UI (`session-lobby/page.tsx`)
Real-time display of checked-in clients:
- Live updates as clients check in
- Connection status indicators
- Automatic reconnection on failures

## Intent Detection System

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
// Confidence: 0.8 for keyword matches
```

2. **AI Detection (Smart Path)**
```typescript
// Uses GPT-4o-mini for natural language understanding
// Can detect variations like:
// - "Just walked into the gym"
// - "Ready to workout"
// - "I've arrived for class"
// NOTE: Currently disabled - goes straight to keyword detection
```

3. **Fallback Chain**
```
1. Try keyword detection
2. If no match → Try AI detection
3. If AI fails → Retry keywords
4. Default to "other" intent
```

## Database Schema

### Key Tables
```sql
-- Users table
user (
  id, 
  phone,        -- Normalized to E.164 format
  businessId,
  name
)

-- Training sessions
TrainingSession (
  id,
  businessId,
  status,       -- 'open', 'in_progress', 'closed'
  scheduledAt,
  durationMinutes
)

-- Check-in records
UserTrainingSession (
  id,
  userId,
  trainingSessionId,
  status,       -- 'registered', 'checked_in'
  checkedInAt,
  preferenceCollectionStep
)

-- Message history
messages (
  id,
  userId,
  businessId,
  direction,    -- 'inbound', 'outbound'
  content,
  phoneNumber,
  metadata,     -- JSON with intent, results, llmCalls array
  status,
  createdAt
)

-- Conversation state for disambiguation
conversation_state (
  id,
  userId,
  trainingSessionId,
  businessId,
  type,         -- 'exercise_disambiguation'
  status,       -- 'pending', 'completed', 'expired'
  context,      -- JSON with options and user input
  createdAt,
  updatedAt,
  expiresAt
)
```

## Preference Collection Flow

After successful check-in, the system initiates a preference collection conversation with a sophisticated state machine:

### Preference Collection State Machine

```
not_started → initial_collected → disambiguation_pending → disambiguation_clarifying → disambiguation_resolved → followup_sent → preferences_active
```

### State Definitions

1. **`not_started`**: User checked in, no preferences yet
2. **`initial_collected`**: First preferences received, determining next step
3. **`disambiguation_pending`**: Waiting for user to select exercise numbers
4. **`disambiguation_clarifying`**: First invalid response, asking for clarification (1 attempt only)
5. **`disambiguation_resolved`**: User selected exercises OR clarification failed
6. **`followup_sent`**: Targeted follow-up question sent (sessionGoal + 1 other field)
7. **`preferences_active`**: In update-only mode, accepting changes indefinitely

### Complete Flow Examples

#### Path 1: Simple preferences (no exercises)
```
User: "Feeling good, medium intensity"
Bot: "Got it! What's your training focus today - strength, endurance, or stability? Also, any specific areas you want to work on?"
State: not_started → initial_collected → followup_sent

User: "Strength focus, work on upper body"
Bot: "Great, thank you for that. If you have anything else to add, let me know."
State: followup_sent → preferences_active

User: "Actually, let's do endurance"
Bot: "Updated to endurance focus. Let me know if you need any other changes."
State: (remains in preferences_active)
```

#### Path 2: With disambiguation (valid response)
```
User: "I want to do presses today"
Bot: "I found multiple exercises matching 'presses'. Please select by number:
     1. Barbell Bench Press
     2. Dumbbell Shoulder Press
     3. Incline Dumbbell Press
     ..."
State: not_started → initial_collected → disambiguation_pending

User: "1 and 3"
Bot: "Perfect! I'll include Barbell Bench Press and Incline Dumbbell Press. What's your training focus today - strength, endurance, or stability?"
State: disambiguation_pending → disambiguation_resolved → followup_sent

User: "Strength"
Bot: "Great, thank you for that. If you have anything else to add, let me know."
State: followup_sent → preferences_active
```

#### Path 3: With disambiguation (invalid response)
```
User: "I want to do presses today"
Bot: "I found multiple exercises matching 'presses'. Please select by number:..."
State: not_started → initial_collected → disambiguation_pending

User: "bench press" (invalid - not a number)
Bot: "I didn't catch that. Please reply with just the numbers of the exercises you want (e.g., '1' or '1,3'). Here are your options again:
     1. Barbell Bench Press
     2. Dumbbell Shoulder Press
     ..."
State: disambiguation_pending → disambiguation_clarifying

User: "the first one" (still invalid)
Bot: "What's your training focus today - strength, endurance, or stability? Also, any areas you'd like to avoid working?"
State: disambiguation_clarifying → disambiguation_resolved → followup_sent
(Exercise selection ignored, moves on)
```

#### Path 4: Mixed preferences with exercises to avoid
```
User: "High intensity today but no squats please"
Bot: "Got it - high intensity and I'll exclude all squat variations. What's your training focus today? Also, any specific areas you want to work on?"
State: not_started → initial_collected → followup_sent

User: "Focus on strength, especially back"
Bot: "Great, thank you for that. If you have anything else to add, let me know."
State: followup_sent → preferences_active
```

### Key Business Rules

1. **Targeted follow-up priorities**:
   - Always ask for `sessionGoal` if not set
   - Then pick 1 other missing field (excluding intensity which has a default)
   - Priority: muscleTargets → avoidJoints/muscleLessens → includeExercises → avoidExercises

2. **Disambiguation rules**:
   - Only triggered for "include exercises" (not exclude)
   - Shows ALL matching options (no truncation)
   - One clarification attempt only
   - Accepts: "1", "1,3", "1 and 2", "1, 2, 3"

3. **Preferences_active behavior**:
   - All new messages UPDATE existing fields (not append)
   - Continues indefinitely until session starts
   - Always responds with "Let me know if you need any other changes"

4. **LLM usage**:
   - Preference parsing: Existing robust parser
   - Targeted follow-up generation: Cheaper LLM (gpt-3.5-turbo) for coach-like questions
   - Exercise matching: Existing hybrid matcher

### Post Check-in Branching Logic
```
┌─────────────────┐
│  Check-in       │
│  Successful     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Send Opening    │ "How are you feeling today? Is there
│ Prompt Message  │  anything I should know before building
└────────┬────────┘  your workout?"
         │
         ▼
┌─────────────────┐
│ Parse User      │
│ Response        │
└────────┬────────┘
         │
    ┌────┴────┬─────────┬─────────┬──────────┐
    │         │         │         │          │
    ▼         ▼         ▼         ▼          ▼
┌────────┐┌────────┐┌────────┐┌────────┐
│Simple  ││Exclude ││Include ││Multiple│
│Prefs   ││Exercise││Exercise││Combined│
└────┬───┘└────┬───┘└────┬───┘└────┬───┘
     │         │         │         │
     ▼         ▼         ▼         ▼
┌────────┐┌────────┐┌────────┐┌────────┐
│Direct  ││Match & ││Disambig││Handle  │
│Save    ││Exclude ││-uate   ││Each    │
└────────┘└────────┘└────┬───┘└────────┘
                         │
                         ▼
                   ┌──────────┐
                   │Send      │ "I found multiple exercises matching your
                   │Options   │  request. Please select by number:"
                   └────┬─────┘ 
                        │       For "bench":
                        │       1. Barbell Bench Press
                        │       2. Dumbbell Bench Press  
                        │       3. Incline Barbell Bench Press
                        │       4. Decline Bench Press
                        │       (Shows ALL matches, no truncation)
                        │
                        ▼
                   ┌──────────┐
                   │Process   │ Accepts: "1", "1,3", "1 and 2"
                   │Selection │ Uses flexible regex pattern
                   └──────────┘
```

### Branch Types

1. **Simple Preferences**: Direct extraction of intensity, session goals, muscle targets
   - Example: "I'm tired today" → `intensity: "low"`
   - Example: "Let's work on stability" → `sessionGoal: "stability"`

2. **Exclude Exercises**: User wants to avoid specific exercises
   - Example: "No squats today" → Match all squat variations
   - Uses hybrid exercise matcher to find all relevant exercises

3. **Include Exercises**: User wants specific exercises (requires disambiguation)
   - Example: "I want to do bench press" → Needs clarification
   - Triggers disambiguation conversation for selection

4. **Multiple Combined**: Mix of preferences in one message
   - Example: "Feeling good, let's go heavy but skip deadlifts"
   - Processes each component appropriately

### Hybrid Exercise Matching System

The exercise matcher receives **extracted exercise phrases** from user messages and uses a streamlined approach with **parallel processing** for better performance:

```
┌─────────────────────┐
│ Extracted Exercise  │ "squats" / "heavy deadlifts" / "back squats"
│      Phrase         │ (Already categorized as include/avoid)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 1. Exercise Type    │ Check if phrase matches a known exercise_type
│    Matching         │ with basic normalization (plurals, spaces)
└──────────┬──────────┘
           │
      ┌────┴───┐
      │Matched?│──Yes──→ Return all exercises with that type
      └────┬───┘
           │No
           ▼
┌─────────────────────┐
│ 2. Deterministic    │ Check specific patterns:
│    Patterns         │ • Modifier + type (heavy squats)
│                     │ • Equipment only (band work)
│                     │ • Movement patterns (pushing/pulling)
└──────────┬──────────┘
           │
      ┌────┴───┐
      │Matched?│──Yes──→ Return filtered exercises
      └────┬───┘
           │No
           ▼
┌─────────────────────┐
│ 3. LLM Matching     │ Handle everything else:
│                     │ • Fuzzy names (back squats, farmer walks)
│                     │ • Abbreviations (RDLs, DB press)
│                     │ • Partial matches (lat pulls)
│                     │ • Ambiguous (leg stuff)
└─────────────────────┘
```

#### Deterministic Rules:

**1. Exercise Type Matching** (with normalization)
```javascript
// Direct mappings
"squats" → exercise_type = 'squat'
"squat" → exercise_type = 'squat'
"lunges" → exercise_type = 'lunge'
"bench" → exercise_type = 'bench_press'
"bench press" → exercise_type = 'bench_press'
"deadlifts" → exercise_type = 'deadlift'
"rows" → exercise_type = 'row'
"pull-ups" → exercise_type = 'pull_up'
"pullups" → exercise_type = 'pull_up'
```

**2. Pattern Matching**
```javascript
// Modifier patterns
"heavy squats" → exercise_type='squat' AND equipment includes 'barbell'
"light squats" → exercise_type='squat' AND equipment includes 'dumbbells'
"bodyweight squats" → exercise_type='squat' AND equipment IS NULL

// Equipment patterns
"band work" → equipment includes 'bands'
"bodyweight" → equipment IS NULL or empty
"dumbbells only" → equipment = ['dumbbells'] exactly

// Movement patterns
"pushing" → movement_pattern IN ('horizontal_push', 'vertical_push')
"pulling" → movement_pattern IN ('horizontal_pull', 'vertical_pull')
"core work" → movement_pattern = 'core'
```

#### What Goes to LLM:
- **Fuzzy names**: "back squats", "goblet squats", "farmer walks"
- **Abbreviations**: "DB press", "BB squats", "RDLs"
- **Partial matches**: "lat pulls", "tri extensions"
- **Misspellings**: "dumbell", "skullcrushers"
- **Vague references**: "leg stuff", "something hard"

#### Key Implementation Details:

1. **Parallel Processing**: All exercise phrases are processed in parallel using `Promise.all()` for better performance
2. **No Muscle Target Inference**: The LLM is explicitly instructed NOT to infer muscle targets from exercise names
   - "I want to do squats" → `includeExercises: ["squats"]`, `muscleTargets: []`
   - Only explicit muscle mentions count: "Let's work legs" → `muscleTargets: ["legs"]`

#### Benefits:
- **Fast**: Common patterns (<20ms) vs LLM (200-500ms)
- **Parallel**: All exercises processed simultaneously
- **Predictable**: Deterministic rules always return same results
- **Accurate**: LLM handles the messy edge cases
- **Simple**: Only 3 steps, easy to debug and maintain

## Response Messages

| Scenario | Message | Broadcast Event |
|----------|---------|-----------------|
| ✅ Successful check-in | "Hello [Name]! You're checked in for the session. Welcome!\n\nHow are you feeling today? Is there anything I should know before building your workout?" | Yes - Updates lobby |
| 🔄 Already checked in | "Hello [Name]! You're already checked in for this session!" | No |
| ⚠️ No open session | "Hello [Name]! There's no open session at your gym right now. Please check with your trainer." | No |
| ❌ No account found | "We couldn't find your account. Contact your trainer to get set up." | No |
| ℹ️ Non check-in message | "Sorry, I can only help with session check-ins. Please text 'here' or 'checking in' when you arrive." | No |

## Testing

### Test Coverage (89 new tests)

#### Unit Tests
1. **`twilio.test.ts`** (7 tests)
   - Phone number normalization
   - Format validation
   - Edge cases

2. **`messageService.test.ts`** (11 tests)
   - Message saving
   - Metadata handling
   - Error scenarios

3. **`checkInService.test.ts`** (11 tests)
   - User lookup
   - Check-in processing
   - Broadcast integration

#### Integration Tests
4. **`sms-checkin-flow.test.ts`** (10 tests)
   - End-to-end SMS flow
   - Intent detection
   - Response generation

5. **`session-lifecycle.test.ts`** (8 tests)
   - Session state transitions
   - Check-in timing
   - Concurrent access

6. **`error-scenarios.test.ts`** (15 tests)
   - Database failures
   - Invalid phone numbers
   - Malformed payloads
   - Broadcast failures

#### Router Tests
7. **`training-session.test.ts`** (20 tests)
   - Session CRUD operations
   - Authorization
   - Business isolation

8. **`messages.test.ts`** (7 tests)
   - Message retrieval
   - Permission checks
   - Trainer access

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/services/checkInService.test.ts

# Run with coverage
npm test -- --coverage
```

## Configuration

### Environment Variables
```env
# Twilio Configuration
TWILIO_ACCOUNT_SID='AC...'
TWILIO_AUTH_TOKEN='...'
TWILIO_PHONE_NUMBER='+1234567890'
SKIP_TWILIO_VALIDATION=false  # Only for development

# OpenAI for intent detection
OPENAI_API_KEY='sk-...'

# SSE Configuration (defaults)
SSE_HEARTBEAT_INTERVAL=30000  # 30 seconds
SSE_MAX_RETRY_ATTEMPTS=5
SSE_INITIAL_RETRY_DELAY=1000
```

### Twilio Webhook Setup
1. Configure webhook URL: `https://your-domain.com/api/sms/inbound`
2. Method: HTTP POST
3. Enable webhook signature validation
4. Ensure A2P 10DLC registration for production

## Security Features

1. **Twilio Webhook Validation**
   - Signature verification on all webhooks
   - Protection against spoofed requests

2. **Phone Number Security**
   - E.164 normalization
   - Multiple format support
   - No phone numbers in logs (future: masking)

3. **Business Isolation**
   - Users can only check into their gym's sessions
   - Trainers can only see their business's messages

4. **Rate Limiting** (future)
   - Prevent SMS flooding
   - Protect against abuse

## Session Test Data Logging

The system includes comprehensive test data logging for debugging preference collection flows:

### Enabling Test Data Logging
```javascript
// In browser console
await sessionTestData.enable()

// Check if enabled
await sessionTestData.isEnabled()

// List all sessions
await sessionTestData.listSessions()

// Get specific session data
await sessionTestData.getSession('session-id')
```

### What Gets Logged
1. **Messages**: All inbound/outbound SMS messages with timestamps
2. **LLM Calls**: 
   - Preference parsing calls with prompts and responses
   - Exercise matching calls with reasoning
   - Disambiguation generation
3. **Exercise Matcher Calls**: Track which matching method was used (exercise_type, pattern, or LLM)

### Session Data Structure
```typescript
{
  sessionId: string,
  phoneNumber: string,
  startTime: string,
  messages: [{
    timestamp: string,
    direction: 'inbound' | 'outbound',
    content: string,
    metadata: any
  }],
  llmCalls: [{
    timestamp: string,
    type: 'preference_parsing' | 'exercise_matching',
    model: string,
    systemPrompt: string,
    userInput: string,
    rawResponse: any,
    parsedResponse?: any,
    parseTimeMs: number
  }],
  exerciseMatcherCalls: [{
    timestamp: string,
    intent: 'include' | 'avoid',
    userInput: string,
    matchMethod: 'exercise_type' | 'pattern' | 'llm',
    matchedExercises: any[],
    confidence: number,
    parseTimeMs: number
  }]
}
```

## Monitoring & Debugging

### Logging Structure
```
[2024-01-15T10:00:00Z] [INFO] [SMSWebhook] Incoming SMS { 
  from: '+15624558688', 
  body: 'here',
  messageSid: 'SM...'
}
[2024-01-15T10:00:00Z] [INFO] [SMSWebhook] SMS interpretation { 
  intent: { type: 'check_in', confidence: 0.8 } 
}
[2024-01-15T10:00:01Z] [INFO] [CheckInService] Processing check-in { 
  originalPhone: '+15624558688', 
  normalizedPhone: '+15624558688' 
}
[2024-01-15T10:00:01Z] [INFO] [CheckInService] Broadcasting check-in event {
  sessionId: 'xxx',
  userId: 'yyy',
  name: 'Tony'
}
[2024-01-15T10:00:02Z] [INFO] [SSE] Event sent to 3 connected clients
```

### Common Issues

1. **"No user found" errors**
   - Check phone number format in database
   - Verify E.164 normalization

2. **SSE connection drops**
   - Check heartbeat logs
   - Verify network stability
   - Review reconnection attempts

3. **Check-ins not appearing in lobby**
   - Verify SSE connection status
   - Check broadcast function registration
   - Review session ID matching

## Performance Considerations

1. **Phone Lookup Optimization**
   - Indexed on normalized phone field
   - Falls back to multiple formats

2. **SSE Scalability**
   - Connection pooling per session
   - Automatic dead connection cleanup
   - Heartbeat monitoring

3. **Message Processing**
   - Async message saving (non-blocking)
   - Keyword detection before AI calls
   - Circuit breakers for external services (future)


## Message Display Format

The messages page shows preference collection data in a clean, expandable format:

### Summary View
- **Preference Collection**: Shows extracted fields in a clean summary
  - Intensity, muscle targets, session goals
  - Include/exclude exercises with match counts
  - Exercise matcher method used (exercise_type ✓, pattern ✓, or LLM ✓)
- **Disambiguation Requests**: Shows exercise options with counts
- **Check-in Messages**: Display check-in status and metadata

### Expandable Sections
Each message can have multiple expandable sections:
1. **Raw LLM Response**: Full JSON response from preference parsing
2. **Exercise Matching Details**: For each matched exercise:
   - Match method used
   - Confidence score
   - LLM reasoning (if applicable)
3. **Multiple LLM Calls**: When both preference parsing and exercise matching use LLM

### Example Display
```
📱 Inbound Message (10:15 AM)
"I'd like to do both deadlifts and squats today"

🤖 AI Response (10:15 AM)
Preference Collection:
• Include Exercises: deadlifts (exercise_type ✓), squats (exercise_type ✓)

[▼ Raw LLM Response]
[▼ Exercise Matching Details]
```

## API Reference

### TRPC Endpoints

#### Training Session Router
```typescript
// Get open session for a business
trainingSession.getOpenSession() 

// Update session status
trainingSession.updateStatus({ id, status })

// Get session with check-ins
trainingSession.getById({ id })
```

#### Messages Router
```typescript
// Get messages for a user (trainer only)
messages.getByUser({ userId })

// Get users with message history
messages.getUsersWithMessages()
```

### REST Endpoints

#### SMS Webhook
```
POST /api/sms/inbound
Body: Twilio webhook payload
Headers: X-Twilio-Signature
```

#### SSE Check-in Stream
```
GET /api/sse/check-ins?sessionId=xxx
Response: Server-Sent Events stream
Events: check-in, heartbeat
```

## Troubleshooting Checklist

- [ ] Verify Twilio webhook is configured correctly
- [ ] Check environment variables are set
- [ ] Confirm database has proper indexes
- [ ] Test phone number normalization
- [ ] Verify SSE connections in browser DevTools
- [ ] Check server logs for errors
- [ ] Confirm user has correct businessId
- [ ] Verify session is in 'open' status
- [ ] Test with different phone formats
- [ ] Monitor AI intent detection performance