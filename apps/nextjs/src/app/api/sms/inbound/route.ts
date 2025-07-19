import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "twilio";
import { interpretSMS, parseWorkoutPreferences } from "@acme/ai";
import { 
  processCheckIn, 
  setBroadcastFunction,
  saveMessage, 
  getUserByPhone,
  twilioClient,
  createLogger,
  WorkoutPreferenceService
} from "@acme/api";
import { broadcastCheckIn } from "../../sse/connections";

// Twilio webhook payload type
interface TwilioSMSPayload {
  MessageSid: string;
  SmsSid: string;
  AccountSid: string;
  MessagingServiceSid?: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
}

const logger = createLogger("SMSWebhook");

export async function POST(request: NextRequest) {
  try {
    // Set up the broadcast function for real-time updates
    setBroadcastFunction(broadcastCheckIn);
    
    // Get the Twilio signature from headers
    const twilioSignature = request.headers.get("X-Twilio-Signature");
    
    if (!twilioSignature) {
      logger.warn("Missing Twilio signature");
      return new NextResponse("Unauthorized", { status: 401 });
    }
    
    // Parse form data (Twilio sends webhooks as application/x-www-form-urlencoded)
    const formData = await request.formData();
    
    // Convert FormData to object for validation
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });
    
    // Validate the webhook signature (skip in development if configured)
    const skipValidation = process.env.SKIP_TWILIO_VALIDATION === "true" || process.env.NODE_ENV === "development";
    
    if (!skipValidation) {
      // For production, use the actual webhook URL configured in Twilio
      const webhookUrl = process.env.TWILIO_WEBHOOK_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}${request.nextUrl.pathname}`;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      
      if (!authToken) {
        logger.error("Missing Twilio auth token");
        return new NextResponse("Service unavailable", { status: 503 });
      }
      
      logger.debug("Validating Twilio signature", {
        webhookUrl,
        signature: twilioSignature,
        paramsCount: Object.keys(params).length
      });
      
      const isValidSignature = validateRequest(
        authToken,
        twilioSignature,
        webhookUrl,
        params
      );
      
      if (!isValidSignature) {
        logger.warn("Invalid Twilio signature", { 
          signature: twilioSignature,
          url: webhookUrl,
          host: request.nextUrl.host,
          protocol: request.nextUrl.protocol,
          pathname: request.nextUrl.pathname
        });
        return new NextResponse("Unauthorized", { status: 401 });
      }
    } else {
      logger.debug("Skipping Twilio signature validation (development mode)");
    }
    
    // Extract SMS data
    const payload: TwilioSMSPayload = {
      MessageSid: formData.get("MessageSid") as string,
      SmsSid: formData.get("SmsSid") as string,
      AccountSid: formData.get("AccountSid") as string,
      MessagingServiceSid: formData.get("MessagingServiceSid") as string | undefined,
      From: formData.get("From") as string,
      To: formData.get("To") as string,
      Body: formData.get("Body") as string,
      NumMedia: formData.get("NumMedia") as string | undefined,
    };


    // Validate required fields
    if (!payload.From || !payload.Body) {
      return new NextResponse("Bad Request: Missing required fields", { status: 400 });
    }

    // Validate Twilio client is configured
    if (!twilioClient) {
      logger.error("Twilio client not configured");
      return new NextResponse("Service unavailable", { status: 503 });
    }
    
    logger.info("Incoming SMS", { 
      from: payload.From, 
      body: payload.Body,
      messageSid: payload.MessageSid 
    });
    
    // First check if user is awaiting preference collection
    const preferenceCheck = await WorkoutPreferenceService.isAwaitingPreferences(payload.From);
    
    if (preferenceCheck.waiting) {
      logger.info("User is awaiting preference collection", { 
        phoneNumber: payload.From,
        userId: preferenceCheck.userId,
        sessionId: preferenceCheck.sessionId 
      });
      
      // Parse preferences with LLM
      const startTime = Date.now();
      const parsedPreferences = await parseWorkoutPreferences(payload.Body);
      const parseTime = Date.now() - startTime;
      
      logger.info("Parsed preferences", { 
        userId: preferenceCheck.userId,
        preferences: parsedPreferences,
        parseTime
      });
      
      // Get user info for message saving
      const userInfo = await getUserByPhone(payload.From);
      
      if (userInfo) {
        // Save inbound preference message with detailed metadata
        await saveMessage({
          userId: userInfo.userId,
          businessId: userInfo.businessId,
          direction: 'inbound',
          content: payload.Body,
          phoneNumber: payload.From,
          metadata: {
            type: 'preference_collection',
            step: preferenceCheck.currentStep,
            twilioMessageSid: payload.MessageSid,
          },
          status: 'delivered',
        });
      }
      
      // Determine next step based on current step and parsed result
      let nextStep: "initial_collected" | "followup_collected" | "complete";
      let response: string;
      
      if (preferenceCheck.currentStep === "not_started") {
        // First response
        if (parsedPreferences.needsFollowUp) {
          nextStep = "initial_collected";
          response = "Thanks! Can you tell me more about what specific areas you'd like to focus on or avoid today?";
        } else {
          nextStep = "complete";
          response = "Perfect! I've got your preferences and will use them to build your workout. See you in the gym!";
        }
      } else {
        // Follow-up response (from initial_collected)
        nextStep = "complete";
        response = "Great! I've got all your preferences now. Your workout will be tailored to how you're feeling today. See you in the gym!";
      }
      
      // Save preferences
      await WorkoutPreferenceService.savePreferences(
        preferenceCheck.userId!,
        preferenceCheck.sessionId!,
        preferenceCheck.businessId!,
        parsedPreferences,
        nextStep
      );
      
      // Save outbound response with LLM parsing details
      if (userInfo) {
        await saveMessage({
          userId: userInfo.userId,
          businessId: userInfo.businessId,
          direction: 'outbound',
          content: response,
          phoneNumber: payload.From,
          metadata: {
            type: 'preference_collection_response',
            step: nextStep,
            llmParsing: {
              model: 'gpt-4o',
              parseTimeMs: parseTime,
              inputLength: payload.Body.length,
              parsedData: parsedPreferences,
              extractedFields: {
                intensity: parsedPreferences.intensity || null,
                muscleTargets: parsedPreferences.muscleTargets || [],
                muscleLessens: parsedPreferences.muscleLessens || [],
                includeExercises: parsedPreferences.includeExercises || [],
                avoidExercises: parsedPreferences.avoidExercises || [],
                avoidJoints: parsedPreferences.avoidJoints || [],
                sessionGoal: parsedPreferences.sessionGoal || null,
                generalNotes: parsedPreferences.generalNotes || null,
                needsFollowUp: parsedPreferences.needsFollowUp || false,
              },
              userInput: payload.Body,
              confidenceIndicators: {
                hasIntensity: !!parsedPreferences.intensity,
                hasMuscleTargets: !!(parsedPreferences.muscleTargets?.length),
                hasRestrictions: !!(parsedPreferences.muscleLessens?.length || parsedPreferences.avoidJoints?.length),
                hasSpecificRequests: !!(parsedPreferences.includeExercises?.length || parsedPreferences.avoidExercises?.length),
                requiresFollowUp: parsedPreferences.needsFollowUp || false,
              }
            }
          },
          status: 'sent',
        });
      }
      
      await twilioClient.messages.create({
        body: response,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: payload.From,
      });
      
      logger.info("Preference response sent", { 
        userId: preferenceCheck.userId,
        needsFollowUp: parsedPreferences.needsFollowUp,
        nextStep
      });
      
      // Return early - preference handled
      return new NextResponse("", { status: 200 });
    }
    
    // Check for common check-in keywords first to skip AI
    const checkInKeywords = [
      "here", "im here", "i'm here", "i am here",
      "ready", "im ready", "i'm ready", "i am ready", 
      "checking in", "check in", "checkin",
      "arrived", "im in", "i'm in", "i am in",
      "present", "at the gym", "at gym"
    ];
    
    const lowerBody = payload.Body.toLowerCase().trim();
    const isCheckIn = checkInKeywords.some(keyword => lowerBody.includes(keyword));
    
    let interpretation;
    if (isCheckIn) {
      // Skip AI completely for check-ins - saves 200-500ms
      interpretation = { intent: { type: "check_in", confidence: 0.9 } };
      logger.info("Check-in detected by keywords, skipping AI", { 
        message: payload.Body,
        detected: true 
      });
    } else {
      // Only use AI for non-check-in messages
      interpretation = await interpretSMS(payload.Body);
      logger.info("SMS interpretation via AI", { 
        intent: interpretation.intent,
        rawMessage: payload.Body 
      });
    }
    
    // Normalize phone number
    let toNumber = payload.From;
    if (toNumber.startsWith("+") && toNumber.length === 11) {
      toNumber = "+1" + toNumber.substring(1);
    }
    
    // Handle based on intent
    let responseMessage = "";
    
    let userId: string | undefined;
    let businessId: string | undefined;
    let checkInSuccess = false;
    let sessionId: string | undefined;
    
    if (interpretation.intent?.type === "check_in") {
      // Process check-in
      const checkInResult = await processCheckIn(payload.From);
      responseMessage = checkInResult.message;
      userId = checkInResult.userId;
      businessId = checkInResult.businessId;
      checkInSuccess = checkInResult.success;
      sessionId = checkInResult.sessionId;
      
      logger.info("Check-in processed", {
        success: checkInResult.success,
        userId: checkInResult.userId,
        sessionId: checkInResult.sessionId,
        shouldStartPreferences: checkInResult.shouldStartPreferences,
      });
      
      // If check-in was successful and preferences haven't been collected, add preference prompt
      if (checkInResult.success && checkInResult.shouldStartPreferences) {
        // Append preference prompt to check-in message
        responseMessage = `${responseMessage}\n\n${WorkoutPreferenceService.PREFERENCE_PROMPT}`;
        
        logger.info("Added preference prompt to check-in response", {
          userId: checkInResult.userId,
          sessionId: checkInResult.sessionId
        });
      }
    } else {
      // For other intents, provide a generic response
      responseMessage = "Sorry, I can only help with session check-ins. Please text 'here' or 'checking in' when you arrive.";
      logger.info("Non-check-in message received", { intent: interpretation.intent?.type });
    }
    
    // Save inbound message if we have a user
    if (userId || interpretation.intent?.type === "check_in") {
      // For check-ins, we need to get user info even if check-in failed
      const userInfo = await getUserByPhone(payload.From);
      
      logger.info("Looking up user for message saving", { 
        phoneNumber: payload.From,
        userFound: !!userInfo,
        userId: userInfo?.userId,
        businessId: userInfo?.businessId
      });
      
      if (userInfo) {
        // Save inbound message
        const inboundSaved = await saveMessage({
          userId: userInfo.userId,
          businessId: userInfo.businessId,
          direction: 'inbound',
          content: payload.Body,
          phoneNumber: payload.From,
          metadata: {
            intent: interpretation.intent,
            twilioMessageSid: payload.MessageSid,
          },
          status: 'delivered',
        });
        
        logger.info("Inbound message save result", { 
          saved: !!inboundSaved,
          messageId: inboundSaved?.id
        });
        
        // Save outbound response
        const outboundSaved = await saveMessage({
          userId: userInfo.userId,
          businessId: userInfo.businessId,
          direction: 'outbound',
          content: responseMessage,
          phoneNumber: payload.From,
          metadata: {
            checkInResult: checkInSuccess ? { success: true, sessionId } : { success: false },
          },
          status: 'sent',
        });
        
        logger.info("Outbound message save result", { 
          saved: !!outboundSaved,
          messageId: outboundSaved?.id
        });
      } else {
        logger.warn("User not found for phone number", { phoneNumber: payload.From });
      }
    }
    
    // Send response SMS asynchronously (don't block the response)
    twilioClient.messages.create({
      body: responseMessage,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: toNumber,
    }).then(() => {
      logger.info("Response SMS sent", { to: toNumber });
    }).catch((error) => {
      logger.error("Failed to send SMS", error);
    });

    // Return 200 immediately to Twilio (faster response)
    return new NextResponse("", { status: 200 });
  } catch (error) {
    console.error("Error processing SMS webhook:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}