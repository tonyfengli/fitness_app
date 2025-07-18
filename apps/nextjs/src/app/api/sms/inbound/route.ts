import { NextRequest, NextResponse } from "next/server";
import { Twilio } from "twilio";
// @ts-ignore - cross-package imports
import { interpretSMS } from "../../../../../../../packages/ai/src/sms/smsInterpretationGraph";
// @ts-ignore - cross-package imports
import { processCheckIn } from "../../../../../../../packages/api/src/services/checkInService";
// @ts-ignore - cross-package imports
import { saveMessage } from "../../../../../../../packages/api/src/services/messageService";
// @ts-ignore - cross-package imports
import { createLogger } from "../../../../../../../packages/api/src/utils/logger";

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
    // Parse form data (Twilio sends webhooks as application/x-www-form-urlencoded)
    const formData = await request.formData();
    
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

    // Initialize Twilio client
    const twilioClient = new Twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
    
    logger.info("Incoming SMS", { 
      from: payload.From, 
      body: payload.Body,
      messageSid: payload.MessageSid 
    });
    
    // Parse intent using LangGraph
    const interpretation = await interpretSMS(payload.Body);
    logger.info("SMS interpretation", { 
      intent: interpretation.intent,
      rawMessage: payload.Body 
    });
    
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
      });
    } else {
      // For other intents, provide a generic response
      responseMessage = "Sorry, I can only help with session check-ins. Please text 'here' or 'checking in' when you arrive.";
      logger.info("Non-check-in message received", { intent: interpretation.intent?.type });
    }
    
    // Save inbound message if we have a user
    if (userId || interpretation.intent?.type === "check_in") {
      // For check-ins, we need to get user info even if check-in failed
      const { getUserByPhone } = await import("../../../../../../../packages/api/src/services/userService");
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
    
    // Send response SMS
    try {
      await twilioClient.messages.create({
        body: responseMessage,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: toNumber,
      });
      logger.info("Response SMS sent", { to: toNumber });
    } catch (error) {
      logger.error("Failed to send SMS", error);
    }

    // Twilio expects an empty 200 response or TwiML
    return new NextResponse("", { status: 200 });
  } catch (error) {
    console.error("Error processing SMS webhook:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}