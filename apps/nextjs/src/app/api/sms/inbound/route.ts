import { NextRequest } from "next/server";
import { SMSWebhookHandler } from "@acme/api";

// Initialize the webhook handler
const webhookHandler = new SMSWebhookHandler();

export async function POST(request: NextRequest) {
  // SSE broadcast functions removed - will be replaced with Supabase Realtime
  
  // Delegate to the webhook handler
  return webhookHandler.handleWebhook(request);
}