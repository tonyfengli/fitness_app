import { Twilio } from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Only initialize Twilio client if credentials are provided
// Use API Key if available (more secure), otherwise fall back to Auth Token
export const twilioClient = 
  apiKey && apiSecret 
    ? new Twilio(apiKey, apiSecret, { accountSid })
    : accountSid && authToken 
    ? new Twilio(accountSid, authToken)
    : null;

export async function sendSMS(to: string, body: string) {
  if (!twilioClient) {
    console.error("Twilio client not initialized - missing credentials");
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const message = await twilioClient.messages.create({
      body,
      from: twilioPhoneNumber,
      to,
    });
    
    console.log(`SMS sent successfully: ${message.sid}`);
    return { success: true, messageId: message.sid };
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return { success: false, error };
  }
}

export function normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, "");
  
  // Add country code if not present (assuming US)
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  // If already has country code
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }
  
  // Return as-is if already in E.164 format
  if (phone.startsWith("+")) {
    return phone;
  }
  
  // Default case - return with + prefix
  return `+${cleaned}`;
}