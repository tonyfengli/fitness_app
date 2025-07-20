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
getUserByPhone(phoneNumber: string): Promise<{userId, businessId} | null>
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
// Uses OpenAI GPT-4o-mini for natural language understanding
// Can detect variations like:
// - "Just walked into the gym"
// - "Ready to workout"
// - "I've arrived for class"
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
  metadata,     -- JSON with intent, results
  status,
  createdAt
)
```

## Preference Collection Flow

After successful check-in, the system initiates a preference collection conversation:

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
                   │Send      │ "Which exercises?"
                   │Options   │ "1. Barbell Bench"
                   └────┬─────┘ "2. Dumbbell Press"
                        │
                        ▼
                   ┌──────────┐
                   │Process   │
                   │Selection │
                   └──────────┘
```

### Branch Types

1. **Simple Preferences**: Direct extraction of intensity, session goals, muscle targets
   - Example: "I'm tired today" → `intensity: "low"`
   - Example: "Let's work on stability" → `sessionGoal: "stability"`

2. **Exclude Exercises**: User wants to avoid specific exercises
   - Example: "No squats today" → Match all squat variations
   - Uses exercise matcher to find all relevant exercises

3. **Include Exercises**: User wants specific exercises (requires disambiguation)
   - Example: "I want to do bench press" → Needs clarification
   - Triggers disambiguation conversation for selection

4. **Multiple Combined**: Mix of preferences in one message
   - Example: "Feeling good, let's go heavy but skip deadlifts"
   - Processes each component appropriately

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

## Future Enhancements

### Completed ✅
- [x] Real-time check-in broadcasting
- [x] Message history tracking
- [x] Comprehensive test coverage
- [x] Session lifecycle management

### Planned 📋
- [ ] Workout preference collection via SMS
- [ ] Check-out functionality
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Push notifications for trainers
- [ ] Client app integration
- [ ] Rate limiting and circuit breakers
- [ ] Enhanced security (data masking, audit logs)

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