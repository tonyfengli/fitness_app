import { NextRequest } from "next/server";
import { SMSWebhookHandler, setBroadcastFunction, setPreferenceBroadcastFunction, setCheckInBroadcastFunction } from "@acme/api";
import { broadcastCheckIn, broadcastPreferenceUpdate } from "../../sse/connections";

// Initialize the webhook handler
const webhookHandler = new SMSWebhookHandler();

export async function POST(request: NextRequest) {
  // Set up the broadcast functions for real-time updates
  setBroadcastFunction(broadcastCheckIn); // For old check-in service
  setCheckInBroadcastFunction(broadcastCheckIn); // For new unified handler
  setPreferenceBroadcastFunction(broadcastPreferenceUpdate);
  
  // Delegate to the webhook handler
  return webhookHandler.handleWebhook(request);
}