"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreferenceStateManager = void 0;
var logger_1 = require("./logger");
var logger = (0, logger_1.createLogger)("PreferenceStateManager");
// Valid state transitions
var STATE_TRANSITIONS = {
    "not_started": ["initial_collected"],
    "initial_collected": ["disambiguation_pending", "followup_sent"],
    "disambiguation_pending": ["disambiguation_clarifying", "disambiguation_resolved"],
    "disambiguation_clarifying": ["disambiguation_resolved"],
    "disambiguation_resolved": ["followup_sent"],
    "followup_sent": ["preferences_active"],
    "preferences_active": ["preferences_active"], // Can stay in active state
};
var PreferenceStateManager = /** @class */ (function () {
    function PreferenceStateManager() {
    }
    /**
     * Validates if a state transition is allowed
     */
    PreferenceStateManager.isValidTransition = function (currentState, nextState) {
        var allowedTransitions = STATE_TRANSITIONS[currentState];
        return allowedTransitions.includes(nextState);
    };
    /**
     * Get the next state based on current state and context
     */
    PreferenceStateManager.getNextState = function (currentState, context) {
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
                logger.error("Unknown preference collection state", { currentState: currentState });
                return null;
        }
    };
    /**
     * Determines if the user is in a state where they can update preferences
     */
    PreferenceStateManager.canUpdatePreferences = function (state) {
        return state === "preferences_active";
    };
    /**
     * Determines if the user is awaiting a specific type of response
     */
    PreferenceStateManager.getExpectedResponseType = function (state) {
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
    };
    /**
     * Log state transition for debugging
     */
    PreferenceStateManager.logTransition = function (userId, sessionId, fromState, toState, reason) {
        logger.info("Preference state transition", {
            userId: userId,
            sessionId: sessionId,
            fromState: fromState,
            toState: toState,
            reason: reason,
            isValid: this.isValidTransition(fromState, toState)
        });
    };
    return PreferenceStateManager;
}());
exports.PreferenceStateManager = PreferenceStateManager;
