# SMS "Here" Check-in Flow Trace for Circuit Training Sessions

## Overview
This document traces the complete flow when a user texts "here" to the Twilio number for checking into a circuit training session.

## 1. Twilio Webhook Reception

### Entry Point
- **File**: `/apps/nextjs/src/app/api/sms/inbound/route.ts`
- **Function**: `POST` handler
- Receives Twilio webhook POST request
- Delegates to `SMSWebhookHandler`

### Webhook Handler
- **File**: `/packages/api/src/services/sms/webhook-handler.ts`
- **Class**: `SMSWebhookHandler`
- **Process**:
  1. Validates webhook signature via `TwilioWebhookValidator`
  2. Extracts SMS payload from request
  3. Converts to `UnifiedMessage` via `SMSAdapter`
  4. Passes to `MessagePipeline` for processing

## 2. User Lookup and Message Conversion

### SMS Adapter
- **File**: `/packages/api/src/services/messaging/adapters/sms-adapter.ts`
- **Function**: `SMSAdapter.fromTwilioWebhook()`
- **Process**:
  1. Extracts phone number from Twilio payload
  2. Calls `getUserByPhone()` to find user
  3. Creates `UnifiedMessage` object with:
     - `userId`: Found user ID
     - `businessId`: User's business ID
     - `trainingSessionId`: Active session ID if user is checked in
     - `content`: SMS body ("here")
     - `channel`: "sms"

### User Lookup
- **File**: `/packages/api/src/services/checkInService.ts`
- **Function**: `getUserByPhone()`
- **Process**:
  1. Normalizes phone number
  2. Queries `user` table by phone
  3. Checks if user is already checked into an active session
  4. Returns user info with optional `trainingSessionId`

## 3. Intent Detection

### Message Pipeline
- **File**: `/packages/api/src/services/messaging/message-pipeline.ts`
- **Class**: `MessagePipeline`
- **Process**:
  1. Populates user info (name, phone)
  2. Logs inbound message
  3. Calls `SMSIntentRouter` to detect intent

### Intent Router
- **File**: `/packages/api/src/services/sms/intent-router.ts`
- **Class**: `SMSIntentRouter`
- **Function**: `interpretMessage()`
- **Process**:
  1. First checks against keyword list:
     - "here", "im here", "i'm here", "ready", "checking in", etc.
  2. If keyword match found, returns `check_in` intent with 0.9 confidence
  3. Falls back to AI interpretation if no keyword match

## 4. Check-in Processing

### Check-in Handler
- **File**: `/packages/api/src/services/messaging/handlers/check-in-handler.ts`
- **Class**: `CheckInHandler`
- **Function**: `handle()`

#### Process Flow:

1. **Find Active Session**:
   - Queries `TrainingSession` table
   - Filters by:
     - `businessId` matches user's business
     - `status` = "in_progress"
   - Returns first matching session

2. **Check Existing Check-in**:
   - Queries `UserTrainingSession` table
   - Filters by `userId` and `trainingSessionId`
   - Determines if user already checked in

3. **Handle Check-in States**:
   
   **If already checked in**:
   - Returns confirmation message
   - No database update needed

   **If registered but not checked in**:
   - Updates existing `UserTrainingSession` record:
     - `status` = "checked_in"
     - `checkedInAt` = current timestamp
   - Sets `isNewCheckIn = true`

   **If not registered**:
   - Creates new `UserTrainingSession` record:
     - `userId`: User's ID
     - `trainingSessionId`: Active session ID
     - `status`: "checked_in"
     - `checkedInAt`: Current timestamp

## 5. Circuit Session Specific Handling

### Circuit Detection
- **Location**: In `CheckInHandler.handle()` around line 179
- **Check**: `if (activeSession.templateType === "circuit")`

### Circuit Response
When session is detected as circuit type:
1. Generates circuit configuration link:
   ```
   ${baseUrl}/sessions/${activeSession.id}/circuit-config
   ```
2. Returns specialized message:
   ```
   Hello {userName}! You're checked in for the circuit training session.
   
   Configure the workout: {circuitConfigLink}
   ```

### Standard Session Response
For non-circuit sessions:
```
Welcome, {userName}! You're checked in. We'll get started once everyone joins.
```

## 6. Response Dispatch

### Response Dispatcher
- **File**: `/packages/api/src/services/messaging/adapters/response-dispatcher.ts`
- Sends response back through appropriate channel (SMS via Twilio)

## Database Schema

### Key Tables:

**TrainingSession**:
- `id`: UUID
- `businessId`: Reference to Business
- `status`: "open", "in_progress", "completed", "cancelled"
- `templateType`: "full_body_bmf", "standard", "circuit"
- `templateConfig`: JSONB (stores circuit configuration)

**UserTrainingSession**:
- `id`: UUID
- `userId`: Reference to User
- `trainingSessionId`: Reference to TrainingSession
- `status`: "registered", "checked_in", "ready", "workout_ready", "completed", "no_show"
- `checkedInAt`: Timestamp
- `preferenceCollectionStep`: Text (preference collection state)

## Circuit Configuration Flow

After check-in for circuit sessions:
1. User receives link to `/sessions/{sessionId}/circuit-config`
2. This page allows configuration of:
   - Number of rounds
   - Exercises per round
   - Work/rest durations
   - Exercise selection
3. Configuration is stored in `TrainingSession.templateConfig`

## Key Differences: Circuit vs Standard Sessions

1. **Response Message**: Circuit sessions include configuration link
2. **Post Check-in Flow**: 
   - Circuit: User configures workout via web interface
   - Standard: Auto-creates default preferences
3. **Template Type**: Stored in `TrainingSession.templateType`
4. **Configuration**: Circuit sessions have `templateConfig` with circuit-specific settings

## Error Handling

- No active session: Returns friendly message to contact trainer
- User not found: Returns "couldn't find account" message
- Database errors: Returns generic error message
- All errors are logged via `unifiedLogger`