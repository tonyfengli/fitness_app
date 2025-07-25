"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreferenceUpdateHandler = void 0;
var workoutPreferenceService_1 = require("../../workoutPreferenceService");
var preferenceUpdateParser_1 = require("../../preferenceUpdateParser");
var targetedFollowupService_1 = require("../../targetedFollowupService");
var exerciseDisambiguationService_1 = require("../../exerciseDisambiguationService");
var messageService_1 = require("../../messageService");
var checkInService_1 = require("../../checkInService");
var logger_1 = require("../../../utils/logger");
var sessionTestDataLogger_1 = require("../../../utils/sessionTestDataLogger");
var logger = (0, logger_1.createLogger)("PreferenceUpdateHandler");
var PreferenceUpdateHandler = /** @class */ (function () {
    function PreferenceUpdateHandler() {
    }
    /**
     * Handle preference updates in active mode
     */
    PreferenceUpdateHandler.prototype.handle = function (phoneNumber, messageContent, messageSid) {
        return __awaiter(this, void 0, void 0, function () {
            var userInfo, currentPreferences, updateResult, validation, disambiguationResult, updatedPreferences, confirmationMessage, error_1;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 14, , 15]);
                        return [4 /*yield*/, (0, checkInService_1.getUserByPhone)(phoneNumber)];
                    case 1:
                        userInfo = _c.sent();
                        if (!userInfo || !userInfo.trainingSessionId) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "No active session found. Please check in first.",
                                    metadata: { reason: "no_session" }
                                }];
                        }
                        return [4 /*yield*/, workoutPreferenceService_1.WorkoutPreferenceService.getPreferences(userInfo.trainingSessionId)];
                    case 2:
                        currentPreferences = _c.sent();
                        if (!currentPreferences) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "No preferences found for this session. Please send your initial preferences first.",
                                    metadata: { reason: "no_preferences" }
                                }];
                        }
                        return [4 /*yield*/, preferenceUpdateParser_1.PreferenceUpdateParser.parseUpdate(messageContent, __assign(__assign({}, currentPreferences), { needsFollowUp: false }), userInfo.businessId)];
                    case 3:
                        updateResult = _c.sent();
                        if (!updateResult.hasUpdates) {
                            // Check if this might be a general query or non-update message
                            if (this.isGeneralQuery(messageContent)) {
                                return [2 /*return*/, {
                                        success: true,
                                        message: "Your current preferences are set. If you need to change anything, just let me know!",
                                        metadata: {
                                            type: "general_query",
                                            currentState: "preferences_active"
                                        }
                                    }];
                            }
                            // Couldn't parse any updates
                            return [2 /*return*/, {
                                    success: true,
                                    message: "I didn't catch what you'd like to change. You can update things like intensity (easy/hard), exercises to add/skip, or areas to focus on.",
                                    metadata: {
                                        type: "parse_failed",
                                        currentState: "preferences_active"
                                    }
                                }];
                        }
                        if (!((_a = updateResult.exerciseValidation) === null || _a === void 0 ? void 0 : _a.needsDisambiguation)) return [3 /*break*/, 9];
                        validation = updateResult.exerciseValidation.includeValidation ||
                            updateResult.exerciseValidation.avoidValidation;
                        disambiguationResult = {
                            needsDisambiguation: true,
                            disambiguationMessage: exerciseDisambiguationService_1.ExerciseDisambiguationService.formatMessage(validation.matches.filter(function (m) { return m.matchedExercises.length > 1; }), {
                                type: 'preference_update',
                                sessionId: userInfo.trainingSessionId,
                                userId: userInfo.userId,
                                businessId: userInfo.businessId
                            }),
                            ambiguousMatches: validation.matches.filter(function (m) { return m.matchedExercises.length > 1; }),
                            allOptions: exerciseDisambiguationService_1.ExerciseDisambiguationService.collectAllOptions(validation.matches.filter(function (m) { return m.matchedExercises.length > 1; }))
                        };
                        if (!disambiguationResult.needsDisambiguation) return [3 /*break*/, 9];
                        // Save disambiguation state
                        return [4 /*yield*/, exerciseDisambiguationService_1.ExerciseDisambiguationService.saveDisambiguationState({
                                ambiguousMatches: disambiguationResult.ambiguousMatches,
                                allOptions: disambiguationResult.allOptions,
                                originalIntent: updateResult.updateType === 'remove' ? 'avoid' : 'include'
                            }, {
                                type: 'preference_update',
                                sessionId: userInfo.trainingSessionId,
                                userId: userInfo.userId,
                                businessId: userInfo.businessId
                            })];
                    case 4:
                        // Save disambiguation state
                        _c.sent();
                        if (!(sessionTestDataLogger_1.sessionTestDataLogger.isEnabled() && userInfo.trainingSessionId)) return [3 /*break*/, 6];
                        sessionTestDataLogger_1.sessionTestDataLogger.initSession(userInfo.trainingSessionId, phoneNumber);
                        // Log inbound message
                        sessionTestDataLogger_1.sessionTestDataLogger.logMessage(userInfo.trainingSessionId, {
                            direction: 'inbound',
                            content: messageContent,
                            metadata: {
                                messageSid: messageSid,
                                currentStep: "preferences_active",
                                updateType: "preference_update",
                                requiresDisambiguation: true
                            }
                        });
                        // Log outbound disambiguation message
                        sessionTestDataLogger_1.sessionTestDataLogger.logMessage(userInfo.trainingSessionId, {
                            direction: 'outbound',
                            content: disambiguationResult.disambiguationMessage,
                            metadata: {
                                type: 'disambiguation_request',
                                ambiguousMatches: disambiguationResult.ambiguousMatches,
                                options: disambiguationResult.allOptions,
                                currentState: "preferences_active"
                            }
                        });
                        return [4 /*yield*/, sessionTestDataLogger_1.sessionTestDataLogger.saveSessionData(userInfo.trainingSessionId)];
                    case 5:
                        _c.sent();
                        _c.label = 6;
                    case 6: 
                    // Save messages
                    return [4 /*yield*/, (0, messageService_1.saveMessage)({
                            userId: userInfo.userId,
                            businessId: userInfo.businessId,
                            direction: 'inbound',
                            content: messageContent,
                            phoneNumber: phoneNumber,
                            metadata: {
                                type: 'preference_update',
                                requiresDisambiguation: true,
                                twilioMessageSid: messageSid,
                            },
                            status: 'delivered',
                        })];
                    case 7:
                        // Save messages
                        _c.sent();
                        return [4 /*yield*/, (0, messageService_1.saveMessage)({
                                userId: userInfo.userId,
                                businessId: userInfo.businessId,
                                direction: 'outbound',
                                content: disambiguationResult.disambiguationMessage,
                                phoneNumber: phoneNumber,
                                metadata: {
                                    type: 'disambiguation_request',
                                    updateContext: 'preference_update',
                                    optionCount: (_b = disambiguationResult.allOptions) === null || _b === void 0 ? void 0 : _b.length
                                },
                                status: 'sent',
                            })];
                    case 8:
                        _c.sent();
                        return [2 /*return*/, {
                                success: true,
                                message: disambiguationResult.disambiguationMessage,
                                metadata: {
                                    userId: userInfo.userId,
                                    businessId: userInfo.businessId,
                                    requiresDisambiguation: true,
                                    currentState: "preferences_active"
                                }
                            }];
                    case 9:
                        updatedPreferences = this.mergePreferences(__assign(__assign({}, currentPreferences), { needsFollowUp: false }), updateResult.updates);
                        // Save the updated preferences
                        return [4 /*yield*/, workoutPreferenceService_1.WorkoutPreferenceService.savePreferences(userInfo.userId, userInfo.trainingSessionId, userInfo.businessId, updatedPreferences, "preferences_active")];
                    case 10:
                        // Save the updated preferences
                        _c.sent();
                        confirmationMessage = targetedFollowupService_1.TargetedFollowupService.generateUpdateResponse(updateResult.fieldsUpdated);
                        // Save messages
                        return [4 /*yield*/, this.saveMessages(phoneNumber, messageContent, messageSid, userInfo, updateResult, confirmationMessage)];
                    case 11:
                        // Save messages
                        _c.sent();
                        if (!(sessionTestDataLogger_1.sessionTestDataLogger.isEnabled() && userInfo.trainingSessionId)) return [3 /*break*/, 13];
                        sessionTestDataLogger_1.sessionTestDataLogger.initSession(userInfo.trainingSessionId, phoneNumber);
                        // Log inbound message
                        sessionTestDataLogger_1.sessionTestDataLogger.logMessage(userInfo.trainingSessionId, {
                            direction: 'inbound',
                            content: messageContent,
                            metadata: {
                                messageSid: messageSid,
                                currentStep: "preferences_active",
                                updateType: "preference_update"
                            }
                        });
                        // Log outbound response
                        sessionTestDataLogger_1.sessionTestDataLogger.logMessage(userInfo.trainingSessionId, {
                            direction: 'outbound',
                            content: confirmationMessage,
                            metadata: {
                                updatedPreferences: updatedPreferences,
                                fieldsUpdated: updateResult.fieldsUpdated,
                                updateType: updateResult.updateType
                            }
                        });
                        // Save session data
                        return [4 /*yield*/, sessionTestDataLogger_1.sessionTestDataLogger.saveSessionData(userInfo.trainingSessionId)];
                    case 12:
                        // Save session data
                        _c.sent();
                        _c.label = 13;
                    case 13:
                        logger.info("Preference update processed", {
                            userId: userInfo.userId,
                            sessionId: userInfo.trainingSessionId,
                            fieldsUpdated: updateResult.fieldsUpdated,
                            updateType: updateResult.updateType
                        });
                        return [2 /*return*/, {
                                success: true,
                                message: confirmationMessage,
                                metadata: {
                                    userId: userInfo.userId,
                                    businessId: userInfo.businessId,
                                    fieldsUpdated: updateResult.fieldsUpdated,
                                    updateType: updateResult.updateType,
                                    currentState: "preferences_active"
                                }
                            }];
                    case 14:
                        error_1 = _c.sent();
                        logger.error("Preference update handler error", error_1);
                        return [2 /*return*/, {
                                success: false,
                                message: "Sorry, I couldn't update your preferences. Please try again.",
                                metadata: { error: error_1 instanceof Error ? error_1.message : "unknown" }
                            }];
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if message is a general query rather than an update
     */
    PreferenceUpdateHandler.prototype.isGeneralQuery = function (message) {
        var queryPatterns = [
            /\b(what|how|when|where|why|who)\b.*\?/i,
            /\b(am i|are we|is it|should i)\b/i,
            /\b(okay|ok|good|great|thanks|thank you|sounds good|perfect)\b/i,
            /^(yes|no|maybe|sure)$/i
        ];
        return queryPatterns.some(function (pattern) { return pattern.test(message); });
    };
    /**
     * Merge current preferences with updates
     */
    PreferenceUpdateHandler.prototype.mergePreferences = function (current, updates) {
        var merged = __assign(__assign({}, current), { needsFollowUp: false });
        // Handle simple overwrites with source tracking
        if (updates.intensity) {
            merged.intensity = updates.intensity;
            merged.intensitySource = 'explicit'; // User explicitly updated
        }
        if (updates.sessionGoal !== undefined) {
            merged.sessionGoal = updates.sessionGoal;
            merged.sessionGoalSource = 'explicit'; // User explicitly updated
        }
        // Handle array merges
        // For includeExercises and avoidExercises, use the updates directly
        // as they've already been processed by PreferenceUpdateParser
        if (updates.includeExercises !== undefined) {
            merged.includeExercises = updates.includeExercises;
        }
        if (updates.avoidExercises !== undefined) {
            merged.avoidExercises = updates.avoidExercises;
        }
        // For muscle and joint arrays, append to existing (avoiding duplicates)
        if (updates.muscleTargets) {
            merged.muscleTargets = Array.from(new Set(__spreadArray(__spreadArray([], (current.muscleTargets || []), true), updates.muscleTargets, true)));
        }
        if (updates.muscleLessens) {
            merged.muscleLessens = Array.from(new Set(__spreadArray(__spreadArray([], (current.muscleLessens || []), true), updates.muscleLessens, true)));
        }
        if (updates.avoidJoints) {
            merged.avoidJoints = Array.from(new Set(__spreadArray(__spreadArray([], (current.avoidJoints || []), true), updates.avoidJoints, true)));
        }
        return merged;
    };
    /**
     * Save inbound and outbound messages
     */
    PreferenceUpdateHandler.prototype.saveMessages = function (phoneNumber, messageContent, messageSid, userInfo, updateResult, confirmationMessage) {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        // Save inbound update message
                        return [4 /*yield*/, (0, messageService_1.saveMessage)({
                                userId: userInfo.userId,
                                businessId: userInfo.businessId,
                                direction: 'inbound',
                                content: messageContent,
                                phoneNumber: phoneNumber,
                                metadata: {
                                    type: 'preference_update',
                                    twilioMessageSid: messageSid,
                                    updateResult: {
                                        fieldsUpdated: updateResult.fieldsUpdated,
                                        updateType: updateResult.updateType
                                    }
                                },
                                status: 'delivered',
                            })];
                    case 1:
                        // Save inbound update message
                        _a.sent();
                        // Save outbound confirmation
                        return [4 /*yield*/, (0, messageService_1.saveMessage)({
                                userId: userInfo.userId,
                                businessId: userInfo.businessId,
                                direction: 'outbound',
                                content: confirmationMessage,
                                phoneNumber: phoneNumber,
                                metadata: {
                                    type: 'preference_update_confirmation',
                                    fieldsUpdated: updateResult.fieldsUpdated
                                },
                                status: 'sent',
                            })];
                    case 2:
                        // Save outbound confirmation
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        logger.error("Failed to save preference update messages", error_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return PreferenceUpdateHandler;
}());
exports.PreferenceUpdateHandler = PreferenceUpdateHandler;
