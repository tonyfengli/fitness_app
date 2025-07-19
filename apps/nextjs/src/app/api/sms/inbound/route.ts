import { NextRequest } from "next/server";
import { SMSWebhookHandler, setBroadcastFunction, setPreferenceBroadcastFunction } from "@acme/api";
import { broadcastCheckIn, broadcastPreferenceUpdate } from "../../sse/connections";

// Initialize the webhook handler
const webhookHandler = new SMSWebhookHandler();

export async function POST(request: NextRequest) {
  // Set up the broadcast functions for real-time updates
  setBroadcastFunction(broadcastCheckIn);
  setPreferenceBroadcastFunction(broadcastPreferenceUpdate);
  
  // Delegate to the webhook handler
  return webhookHandler.handleWebhook(request);
}