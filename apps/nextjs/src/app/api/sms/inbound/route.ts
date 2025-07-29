import { NextRequest } from "next/server";
import { SMSWebhookHandler } from "@acme/api";

// Initialize the webhook handler
const webhookHandler = new SMSWebhookHandler();

export async function POST(request: NextRequest) {
  console.log('[SMS Webhook] Received POST request at:', new Date().toISOString());
  console.log('[SMS Webhook] Headers:', Object.fromEntries(request.headers.entries()));
  console.log('[SMS Webhook] SKIP_TWILIO_VALIDATION env var:', process.env.SKIP_TWILIO_VALIDATION);
  console.log('[SMS Webhook] NODE_ENV:', process.env.NODE_ENV);
  
  // SSE broadcast functions removed - will be replaced with Supabase Realtime
  
  // Delegate to the webhook handler
  return webhookHandler.handleWebhook(request);
}