import type { SMSStateType } from "../types/smsTypes";

export async function buildQueryNode(state: SMSStateType) {
  try {
    if (!state.intent || !state.context) {
      return {
        error: "Missing intent or context for building query",
      };
    }

    let structuredQuery;
    const { intent, context } = state;

    switch (intent.type) {
      case "schedule":
        structuredQuery = {
          action: "CREATE_BOOKING",
          parameters: {
            clientName: context.clientName,
            clientId: context.clientId,
            sessionType: context.sessionType || "personal_training",
            preferredDate: context.preferredDate,
            preferredTime: context.preferredTime,
            notes: context.additionalNotes,
          },
          requiresHumanReview:
            intent.confidence < 0.8 ||
            !context.preferredDate ||
            !context.preferredTime,
        };
        break;

      case "cancel":
        structuredQuery = {
          action: "CANCEL_BOOKING",
          parameters: {
            clientName: context.clientName,
            clientId: context.clientId,
            sessionDate: context.preferredDate,
            sessionTime: context.preferredTime,
            reason: context.additionalNotes,
          },
          requiresHumanReview:
            intent.confidence < 0.8 ||
            (!context.clientId && !context.clientName),
        };
        break;

      case "reschedule":
        structuredQuery = {
          action: "RESCHEDULE_BOOKING",
          parameters: {
            clientName: context.clientName,
            clientId: context.clientId,
            newDate: context.preferredDate,
            newTime: context.preferredTime,
            notes: context.additionalNotes,
          },
          requiresHumanReview:
            intent.confidence < 0.8 ||
            !context.preferredDate ||
            !context.preferredTime,
        };
        break;

      case "inquiry":
        structuredQuery = {
          action: "HANDLE_INQUIRY",
          parameters: {
            clientName: context.clientName,
            clientId: context.clientId,
            inquiryType: context.sessionType,
            details: context.additionalNotes || state.rawMessage,
          },
          requiresHumanReview: true, // Always review inquiries
        };
        break;

      default:
        structuredQuery = {
          action: "FORWARD_TO_HUMAN",
          parameters: {
            originalMessage: state.rawMessage,
            intent: intent.type,
            confidence: intent.confidence,
          },
          requiresHumanReview: true,
        };
    }

    return {
      structuredQuery,
    };
  } catch (error) {
    console.error("Error building query:", error);
    return {
      error: `Failed to build query: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
