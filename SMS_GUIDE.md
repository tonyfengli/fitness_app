# SMS Check-in System Guide

## Overview
The SMS check-in system allows fitness clients to check into their sessions by sending a simple text message. The system uses AI-powered intent detection with keyword fallbacks to ensure reliability.

## Architecture Flow

```
┌─────────────┐     ┌──────────┐     ┌───────────────┐
│   Client    │────▶│  Twilio  │────▶│   Webhook     │
│   Phone     │ SMS │          │POST │  /api/sms/    │
└─────────────┘     └──────────┘     │   inbound     │
                                     └───────┬───────┘
                                             │
                                             ▼
                                     ┌───────────────┐
                                     │ Parse Intent  │
                                     │  (LangGraph)  │
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
                          ▼
                 ┌─────────────────┐
                 │ Database Lookup │
                 │ - Find User     │
                 │ - Find Session  │
                 │ - Create Check-in│
                 └────────┬────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │  Send Response  │
                 │   via Twilio    │
                 └─────────────────┘
```

## Intent Detection Logic

### 1. Keyword Detection (Fast Path)
```typescript
CHECK_IN_KEYWORDS = [
  "here", "im here", "i'm here", "i am here",
  "ready", "im ready", "i'm ready", "i am ready",
  "checking in", "check in", "checkin",
  "arrived", "im in", "i'm in", "i am in",
  "present", "at the gym", "at gym"
]

// If message contains any keyword → intent: "check_in" (confidence: 0.8)
```

### 2. LLM Detection (When No Keywords Match)
```typescript
// Send to OpenAI GPT-4o-mini
// Prompt asks: Is this a check-in message?
// Returns: "check_in" or "other" with confidence score
```

### 3. Fallback Chain
```
1. Try keyword detection
2. If no match → Try LLM
3. If LLM fails → Try keywords again
4. If still no match → Default to "other"
```

## Check-in Service Logic

### Step 1: Phone Number Lookup
```typescript
// Try multiple formats:
1. Normalized: "+15624558688"
2. Without country: "5624558688"  
3. Original format from Twilio
```

### Step 2: Find Active Session
```sql
SELECT * FROM training_session
WHERE business_id = user.business_id
  AND scheduled_at <= NOW()
  AND scheduled_at + duration_minutes > NOW()
```

### Step 3: Process Check-in
```typescript
if (no user found) {
  return "We couldn't find your account. Contact your trainer to get set up."
}

if (no active session) {
  return "Hello [Name]! There's no active session at your gym right now. Please check with your trainer."
}

if (already checked in) {
  return "Hello [Name]! You're already checked in for this session!"
}

// Create or update check-in record
return "Hello [Name]! You're checked in for the session. Welcome!"
```

## Response Messages

| Scenario | Message |
|----------|---------|
| ✅ Successful check-in | "Hello [Name]! You're checked in for the session. Welcome!" |
| 🔄 Already checked in | "Hello [Name]! You're already checked in for this session!" |
| ⚠️ No active session | "Hello [Name]! There's no active session at your gym right now. Please check with your trainer." |
| ❌ No account found | "We couldn't find your account. Contact your trainer to get set up." |
| ℹ️ Non check-in message | "Sorry, I can only help with session check-ins. Please text 'here' or 'checking in' when you arrive." |

## Testing the System

### Test Scenarios

1. **Valid Check-in**
   - Send: "here" or "checking in"
   - Expected: Personalized welcome message

2. **Creative Check-in (Tests LLM)**
   - Send: "Just arrived at the gym"
   - Expected: Should detect as check-in via LLM

3. **Non Check-in Message**
   - Send: "What time is class?"
   - Expected: Generic response about only handling check-ins

4. **Edge Cases**
   - Already checked in
   - No active session
   - Unregistered phone number

### Console Logging

The system logs at each step for debugging:
```
[SMSWebhook] Incoming SMS { from: '+15624558688', body: 'here' }
[SMSWebhook] SMS interpretation { intent: { type: 'check_in', confidence: 0.8 } }
[CheckInService] Processing check-in { originalPhone: '+15624558688', normalizedPhone: '+15624558688' }
[CheckInService] User found { userId: '...', businessId: '...', name: 'Tony' }
[CheckInService] Active session found { sessionId: '...' }
[CheckInService] Created new check-in { userId: '...', sessionId: '...', checkInId: '...' }
[SMSWebhook] Check-in processed { success: true }
[SMSWebhook] Response SMS sent { to: '+15624558688' }
```

## Configuration Requirements

### Environment Variables
```env
TWILIO_ACCOUNT_SID='AC...'
TWILIO_AUTH_TOKEN='...'
TWILIO_PHONE_NUMBER='+1234567890'
OPENAI_API_KEY='sk-...'
```

### Twilio Setup
1. Configure webhook URL: `https://your-domain.com/api/sms/inbound`
2. Method: HTTP POST
3. Ensure phone number has A2P 10DLC registration

### Database Requirements
- Users must have phone numbers stored
- Training sessions must have:
  - `scheduled_at` timestamp
  - `duration_minutes` for session window
  - Proper `business_id` associations

## Error Handling

- **LLM Failure**: Falls back to keyword detection
- **Database Error**: Returns generic error message
- **SMS Send Failure**: Logs error, no user impact
- **Missing Phone Formats**: Tries multiple formats before failing

## Security Considerations

1. **Phone Normalization**: Handles multiple formats securely
2. **Business Isolation**: Users can only check into their gym's sessions
3. **Duplicate Prevention**: One check-in per user per session
4. **Input Validation**: All inputs sanitized before processing

## Future Enhancements

- [ ] Support time zone handling for sessions
- [ ] Add check-out functionality
- [ ] Support group messaging for class reminders
- [ ] Add trainer notifications for check-ins
- [ ] Support multiple languages