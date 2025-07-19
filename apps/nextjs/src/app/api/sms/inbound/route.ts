import { NextRequest } from "next/server";
import { SMSWebhookHandler, setBroadcastFunction } from "@acme/api";
import { broadcastCheckIn } from "../../sse/connections";

// Initialize the webhook handler
const webhookHandler = new SMSWebhookHandler();

export async function POST(request: NextRequest) {
  // Set up the broadcast function for real-time updates
  setBroadcastFunction(broadcastCheckIn);
  
  // Delegate to the webhook handler
  return webhookHandler.handleWebhook(request);
}