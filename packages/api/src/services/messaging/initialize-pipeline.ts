import { setBroadcastFunction as setCheckInBroadcast } from './handlers/check-in-handler';

export function initializePipeline(
  broadcastCheckIn?: (sessionId: string, clientData: {
    userId: string;
    name: string;
    checkedInAt: string;
  }) => void,
  broadcastPreferenceUpdate?: (sessionId: string, preferenceData: {
    userId: string;
    preferences: any;
  }) => void
) {
  if (broadcastCheckIn) {
    setCheckInBroadcast(broadcastCheckIn);
  }
  
  // TODO: Set preference broadcast when preference handler is implemented
  // if (broadcastPreferenceUpdate) {
  //   setPreferenceBroadcast(broadcastPreferenceUpdate);
  // }
}