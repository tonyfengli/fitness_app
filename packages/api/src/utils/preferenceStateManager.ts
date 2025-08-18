import { createLogger } from "./logger";

const logger = createLogger("PreferenceStateManager");

export type PreferenceCollectionStep =
  | "not_started"
  | "initial_collected"
  | "disambiguation_pending"
  | "disambiguation_clarifying"
  | "disambiguation_resolved"
  | "followup_sent"
  | "preferences_active";

// Valid state transitions
const STATE_TRANSITIONS: Record<
  PreferenceCollectionStep,
  PreferenceCollectionStep[]
> = {
  not_started: ["initial_collected"],
  initial_collected: ["disambiguation_pending", "followup_sent"],
  disambiguation_pending: [
    "disambiguation_clarifying",
    "disambiguation_resolved",
  ],
  disambiguation_clarifying: ["disambiguation_resolved"],
  disambiguation_resolved: ["followup_sent"],
  followup_sent: ["preferences_active"],
  preferences_active: ["preferences_active"], // Can stay in active state
};

export class PreferenceStateManager {
  /**
   * Validates if a state transition is allowed
   */
  static isValidTransition(
    currentState: PreferenceCollectionStep,
    nextState: PreferenceCollectionStep,
  ): boolean {
    const allowedTransitions = STATE_TRANSITIONS[currentState];
    return allowedTransitions.includes(nextState);
  }

  /**
   * Get the next state based on current state and context
   */
  static getNextState(
    currentState: PreferenceCollectionStep,
    context: {
      needsDisambiguation?: boolean;
      disambiguationFailed?: boolean;
      isFollowupResponse?: boolean;
    },
  ): PreferenceCollectionStep | null {
    switch (currentState) {
      case "not_started":
        return "initial_collected";

      case "initial_collected":
        if (context.needsDisambiguation) {
          return "disambiguation_pending";
        }
        return "followup_sent";

      case "disambiguation_pending":
        if (context.disambiguationFailed) {
          return "disambiguation_clarifying";
        }
        return "disambiguation_resolved";

      case "disambiguation_clarifying":
        return "disambiguation_resolved";

      case "disambiguation_resolved":
        return "followup_sent";

      case "followup_sent":
        if (context.isFollowupResponse) {
          return "preferences_active";
        }
        return null;

      case "preferences_active":
        return "preferences_active"; // Stay in active state

      default:
        logger.error("Unknown preference collection state", { currentState });
        return null;
    }
  }

  /**
   * Determines if the user is in a state where they can update preferences
   */
  static canUpdatePreferences(state: PreferenceCollectionStep): boolean {
    return state === "preferences_active";
  }

  /**
   * Determines if the user is awaiting a specific type of response
   */
  static getExpectedResponseType(
    state: PreferenceCollectionStep,
  ): "initial" | "disambiguation" | "followup" | "update" | null {
    switch (state) {
      case "not_started":
        return "initial";
      case "disambiguation_pending":
      case "disambiguation_clarifying":
        return "disambiguation";
      case "followup_sent":
        return "followup";
      case "preferences_active":
        return "update";
      default:
        return null;
    }
  }

  /**
   * Log state transition for debugging
   */
  static logTransition(
    userId: string,
    sessionId: string,
    fromState: PreferenceCollectionStep,
    toState: PreferenceCollectionStep,
    reason?: string,
  ): void {
    logger.info("Preference state transition", {
      userId,
      sessionId,
      fromState,
      toState,
      reason,
      isValid: this.isValidTransition(fromState, toState),
    });
  }
}
