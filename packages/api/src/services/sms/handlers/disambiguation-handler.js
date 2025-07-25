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
exports.DisambiguationHandler = void 0;
var conversationStateService_1 = require("../../conversationStateService");
var workoutPreferenceService_1 = require("../../workoutPreferenceService");
var messageService_1 = require("../../messageService");
var checkInService_1 = require("../../checkInService");
var logger_1 = require("../../../utils/logger");
var logger = (0, logger_1.createLogger)("DisambiguationHandler");
var DisambiguationHandler = /** @class */ (function () {
    function DisambiguationHandler() {
    }
    /**
     * Generate a clarification message based on the error type
     */
    DisambiguationHandler.generateClarificationMessage = function (errorType, maxOption) {
        switch (errorType) {
            case 'mixed_content':
                return maxOption === 1
                    ? "I just need the number '1' to confirm your choice."
                    : "I just need the numbers (1-".concat(maxOption, "). For example: \"1\" or \"1,3\"");
            case 'no_numbers':
                return maxOption === 1
                    ? "Please reply with '1' to select that exercise."
                    : "Please reply with just the numbers of your choices (1-".concat(maxOption, "). For example: \"2\" or \"1,3\"");
            case 'invalid_format':
                return "Please use only numbers separated by commas. For example: \"1\" or \"2,4\" (choose from 1-".concat(maxOption, ")");
            default:
                return "Please reply with numbers only (1-".concat(maxOption, ")");
        }
    };
    /**
     * Check if a message is a disambiguation response (numbers only)
     * Returns detailed error information for clarification responses
     */
    DisambiguationHandler.isDisambiguationResponse = function (message) {
        var _a;
        var cleaned = message.trim().toLowerCase();
        // Check for common mixed content patterns
        if (/\b(yes|no|maybe|ok|sure|thanks|please|want|need|like|don't|dont)\b/i.test(message)) {
            return {
                isValid: false,
                errorType: 'mixed_content',
                errorDetail: 'Message contains words instead of just numbers'
            };
        }
        // Check if message contains only numbers, commas, spaces, and connecting words
        var validPattern = /^[\d\s,]+(\s+(and|&)\s+[\d\s,]+)*$/;
        if (!validPattern.test(cleaned)) {
            // Check if there are any numbers at all
            var hasNumbers = /\d/.test(cleaned);
            return {
                isValid: false,
                errorType: hasNumbers ? 'invalid_format' : 'no_numbers',
                errorDetail: hasNumbers ?
                    'Message contains numbers but also other text' :
                    'Message contains no numbers'
            };
        }
        // Extract all numbers from the message
        var numbers = ((_a = cleaned
            .match(/\d+/g) // Find all number sequences
        ) === null || _a === void 0 ? void 0 : _a.map(function (n) { return parseInt(n); }).filter(function (n) { return !isNaN(n) && n > 0; })) || [];
        if (numbers.length === 0) {
            return {
                isValid: false,
                errorType: 'no_numbers',
                errorDetail: 'No valid numbers found'
            };
        }
        return {
            isValid: true,
            selections: numbers
        };
    };
    DisambiguationHandler.prototype.handle = function (phoneNumber, messageContent, messageSid) {
        return __awaiter(this, void 0, void 0, function () {
            var userInfo, pending, parseResult, clarificationAttempts, TargetedFollowupService_1, currentPrefs, followupResult_1, clarificationMessage, selections, maxOption_1, invalidSelections, selectedExercises, existingPrefs, mergedIncludeExercises, TargetedFollowupService, followupResult, exerciseNames, confirmationPrefix, response, error_1;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 18, , 19]);
                        return [4 /*yield*/, (0, checkInService_1.getUserByPhone)(phoneNumber)];
                    case 1:
                        userInfo = _c.sent();
                        if (!userInfo) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "Account not found. Please contact your trainer.",
                                    metadata: { reason: "no_user" }
                                }];
                        }
                        return [4 /*yield*/, conversationStateService_1.ConversationStateService.getPendingDisambiguation(userInfo.userId, userInfo.trainingSessionId)];
                    case 2:
                        pending = _c.sent();
                        if (!pending) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "No pending exercise selection found. Please send your workout preferences again.",
                                    metadata: { reason: "no_pending_disambiguation" }
                                }];
                        }
                        parseResult = DisambiguationHandler.isDisambiguationResponse(messageContent);
                        if (!!parseResult.isValid) return [3 /*break*/, 10];
                        clarificationAttempts = (((_b = (_a = pending.state) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.clarificationAttempts) || 0);
                        if (!(clarificationAttempts >= 1)) return [3 /*break*/, 8];
                        // Skip to follow-up after one failed clarification
                        logger.info("Skipping to follow-up after clarification failure", {
                            userId: userInfo.userId,
                            attempts: clarificationAttempts + 1
                        });
                        // Update preference state to skip disambiguation
                        return [4 /*yield*/, workoutPreferenceService_1.WorkoutPreferenceService.savePreferences(userInfo.userId, userInfo.trainingSessionId, userInfo.businessId, {}, "disambiguation_clarifying")];
                    case 3:
                        // Update preference state to skip disambiguation
                        _c.sent();
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("../../targetedFollowupService"); })];
                    case 4:
                        TargetedFollowupService_1 = (_c.sent()).TargetedFollowupService;
                        return [4 /*yield*/, workoutPreferenceService_1.WorkoutPreferenceService.getPreferences(userInfo.trainingSessionId)];
                    case 5:
                        currentPrefs = _c.sent();
                        return [4 /*yield*/, TargetedFollowupService_1.generateFollowup("disambiguation_clarifying", currentPrefs || {})];
                    case 6:
                        followupResult_1 = _c.sent();
                        // Update to followup_sent state
                        return [4 /*yield*/, workoutPreferenceService_1.WorkoutPreferenceService.savePreferences(userInfo.userId, userInfo.trainingSessionId, userInfo.businessId, {}, "followup_sent")];
                    case 7:
                        // Update to followup_sent state
                        _c.sent();
                        return [2 /*return*/, {
                                success: true,
                                message: "I'll note that for your workout. ".concat(followupResult_1.followupQuestion),
                                metadata: {
                                    skippedDisambiguation: true,
                                    clarificationAttempts: clarificationAttempts + 1,
                                    nextStep: "followup_sent"
                                }
                            }];
                    case 8: 
                    // First clarification attempt - update attempts count
                    return [4 /*yield*/, conversationStateService_1.ConversationStateService.updateDisambiguationAttempts(pending.id, clarificationAttempts + 1)];
                    case 9:
                        // First clarification attempt - update attempts count
                        _c.sent();
                        clarificationMessage = DisambiguationHandler.generateClarificationMessage(parseResult.errorType, pending.options.length);
                        return [2 /*return*/, {
                                success: false,
                                message: clarificationMessage,
                                metadata: {
                                    reason: "clarification_needed",
                                    errorType: parseResult.errorType,
                                    clarificationAttempt: clarificationAttempts + 1
                                }
                            }];
                    case 10:
                        selections = parseResult.selections;
                        maxOption_1 = pending.options.length;
                        invalidSelections = selections.filter(function (n) { return n > maxOption_1; });
                        if (invalidSelections.length > 0) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "Invalid selection(s): ".concat(invalidSelections.join(', '), ". Please choose from 1-").concat(maxOption_1, "."),
                                    metadata: { reason: "out_of_range" }
                                }];
                        }
                        return [4 /*yield*/, conversationStateService_1.ConversationStateService.processSelection(pending.id, selections)];
                    case 11:
                        selectedExercises = _c.sent();
                        return [4 /*yield*/, workoutPreferenceService_1.WorkoutPreferenceService.getPreferences(userInfo.trainingSessionId)];
                    case 12:
                        existingPrefs = _c.sent();
                        mergedIncludeExercises = __spreadArray(__spreadArray([], ((existingPrefs === null || existingPrefs === void 0 ? void 0 : existingPrefs.includeExercises) || []), true), selectedExercises.map(function (ex) { return ex.name; }), true);
                        // Save the merged preferences
                        return [4 /*yield*/, workoutPreferenceService_1.WorkoutPreferenceService.savePreferences(userInfo.userId, userInfo.trainingSessionId, userInfo.businessId, __assign(__assign({}, existingPrefs), { includeExercises: mergedIncludeExercises }), "disambiguation_resolved")];
                    case 13:
                        // Save the merged preferences
                        _c.sent();
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("../../targetedFollowupService"); })];
                    case 14:
                        TargetedFollowupService = (_c.sent()).TargetedFollowupService;
                        return [4 /*yield*/, TargetedFollowupService.generateFollowup("disambiguation_resolved", __assign(__assign({}, existingPrefs), { includeExercises: mergedIncludeExercises }))];
                    case 15:
                        followupResult = _c.sent();
                        // Update state to followup_sent
                        return [4 /*yield*/, workoutPreferenceService_1.WorkoutPreferenceService.savePreferences(userInfo.userId, userInfo.trainingSessionId, userInfo.businessId, {}, "followup_sent")];
                    case 16:
                        // Update state to followup_sent
                        _c.sent();
                        // Save messages
                        return [4 /*yield*/, this.saveMessages(phoneNumber, messageContent, messageSid, userInfo, pending, selectedExercises)];
                    case 17:
                        // Save messages
                        _c.sent();
                        exerciseNames = selectedExercises.map(function (ex) { return ex.name; }).join(", ");
                        confirmationPrefix = selectedExercises.length === 1
                            ? "Perfect! I'll include ".concat(exerciseNames, ". ")
                            : "Perfect! I'll include ".concat(exerciseNames, ". ");
                        response = confirmationPrefix + followupResult.followupQuestion;
                        logger.info("Disambiguation completed with follow-up", {
                            userId: userInfo.userId,
                            selectedCount: selectedExercises.length,
                            exercises: exerciseNames,
                            followupFieldsAsked: followupResult.fieldsAsked
                        });
                        return [2 /*return*/, {
                                success: true,
                                message: response,
                                metadata: {
                                    userId: userInfo.userId,
                                    businessId: userInfo.businessId,
                                    selectedExercises: exerciseNames,
                                    nextStep: "followup_sent"
                                }
                            }];
                    case 18:
                        error_1 = _c.sent();
                        logger.error("Disambiguation handler error", error_1);
                        return [2 /*return*/, {
                                success: false,
                                message: "Sorry, something went wrong. Please try again.",
                                metadata: { error: error_1 instanceof Error ? error_1.message : "unknown" }
                            }];
                    case 19: return [2 /*return*/];
                }
            });
        });
    };
    DisambiguationHandler.prototype.saveMessages = function (phoneNumber, messageContent, messageSid, userInfo, pending, selectedExercises) {
        return __awaiter(this, void 0, void 0, function () {
            var exerciseNames, response, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        // Save inbound selection message
                        return [4 /*yield*/, (0, messageService_1.saveMessage)({
                                userId: userInfo.userId,
                                businessId: userInfo.businessId,
                                direction: 'inbound',
                                content: messageContent,
                                phoneNumber: phoneNumber,
                                metadata: {
                                    type: 'disambiguation_response',
                                    twilioMessageSid: messageSid,
                                    pendingContext: {
                                        originalInput: pending.userInput,
                                        optionsShown: pending.options.length
                                    }
                                },
                                status: 'delivered',
                            })];
                    case 1:
                        // Save inbound selection message
                        _a.sent();
                        exerciseNames = selectedExercises.map(function (ex) { return ex.name; }).join(", ");
                        response = selectedExercises.length === 1
                            ? "Perfect! I'll make sure to include ".concat(exerciseNames, " in your workout.")
                            : "Perfect! I'll make sure to include these exercises in your workout: ".concat(exerciseNames);
                        return [4 /*yield*/, (0, messageService_1.saveMessage)({
                                userId: userInfo.userId,
                                businessId: userInfo.businessId,
                                direction: 'outbound',
                                content: response,
                                phoneNumber: phoneNumber,
                                metadata: {
                                    type: 'disambiguation_confirmation',
                                    selectedExercises: exerciseNames,
                                    selectionCount: selectedExercises.length
                                },
                                status: 'sent',
                            })];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        logger.error("Failed to save disambiguation messages", error_2);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return DisambiguationHandler;
}());
exports.DisambiguationHandler = DisambiguationHandler;
