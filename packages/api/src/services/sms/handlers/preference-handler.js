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
exports.PreferenceHandler = void 0;
var ai_1 = require("@acme/ai");
var messageService_1 = require("../../messageService");
var checkInService_1 = require("../../checkInService");
var workoutPreferenceService_1 = require("../../workoutPreferenceService");
var exerciseValidationService_1 = require("../../exerciseValidationService");
var conversationStateService_1 = require("../../conversationStateService");
var logger_1 = require("../../../utils/logger");
var sessionTestDataLogger_1 = require("../../../utils/sessionTestDataLogger");
var targetedFollowupService_1 = require("../../targetedFollowupService");
var logger = (0, logger_1.createLogger)("PreferenceHandler");
var PreferenceHandler = /** @class */ (function () {
    function PreferenceHandler() {
    }
    PreferenceHandler.prototype.handle = function (phoneNumber, messageContent, messageSid, preferenceCheck) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, parsedPreferences, parseTime, existingPrefs, mergedPreferences, validatedPreferences, exerciseValidationInfo, newAvoidExercises, newIncludeExercises, filteredIncludes, existingIncludes, avoidValidation, validatedAvoidsLower_1, includeValidation, ambiguousMatches, preDisambiguationSave, currentIncludes, error_1, _a, nextStep, response, error_2;
            var _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _g.trys.push([0, 19, , 20]);
                        logger.info("Handling preference response", {
                            phoneNumber: phoneNumber,
                            userId: preferenceCheck.userId,
                            trainingSessionId: preferenceCheck.trainingSessionId,
                            currentStep: preferenceCheck.currentStep
                        });
                        // Initialize session test data logging
                        if (sessionTestDataLogger_1.sessionTestDataLogger.isEnabled()) {
                            sessionTestDataLogger_1.sessionTestDataLogger.initSession(preferenceCheck.trainingSessionId, phoneNumber);
                            // Log inbound message
                            sessionTestDataLogger_1.sessionTestDataLogger.logMessage(preferenceCheck.trainingSessionId, {
                                direction: 'inbound',
                                content: messageContent,
                                metadata: {
                                    messageSid: messageSid,
                                    currentStep: preferenceCheck.currentStep
                                }
                            });
                        }
                        startTime = Date.now();
                        return [4 /*yield*/, (0, ai_1.parseWorkoutPreferences)(messageContent)];
                    case 1:
                        parsedPreferences = _g.sent();
                        parseTime = Date.now() - startTime;
                        logger.info("Parsed preferences", {
                            userId: preferenceCheck.userId,
                            preferences: parsedPreferences,
                            parseTime: parseTime
                        });
                        existingPrefs = null;
                        if (!(preferenceCheck.currentStep === "followup_sent")) return [3 /*break*/, 3];
                        return [4 /*yield*/, workoutPreferenceService_1.WorkoutPreferenceService.getPreferences(preferenceCheck.trainingSessionId)];
                    case 2:
                        existingPrefs = _g.sent();
                        _g.label = 3;
                    case 3:
                        mergedPreferences = void 0;
                        if (preferenceCheck.currentStep === "followup_sent") {
                            if (existingPrefs) {
                                logger.info("Merging follow-up preferences with existing", {
                                    existing: existingPrefs,
                                    new: parsedPreferences
                                });
                                // Merge preferences, keeping existing values when new ones are empty/undefined
                                mergedPreferences = {
                                    // Only update intensity if explicitly provided (not undefined)
                                    intensity: parsedPreferences.intensity !== undefined
                                        ? parsedPreferences.intensity
                                        : existingPrefs.intensity,
                                    intensitySource: parsedPreferences.intensity !== undefined
                                        ? 'explicit'
                                        : 'inherited', // If not mentioned in follow-up, it's inherited
                                    muscleTargets: (parsedPreferences.muscleTargets && parsedPreferences.muscleTargets.length > 0)
                                        ? __spreadArray(__spreadArray([], (existingPrefs.muscleTargets || []), true), parsedPreferences.muscleTargets, true) : existingPrefs.muscleTargets,
                                    muscleLessens: (parsedPreferences.muscleLessens && parsedPreferences.muscleLessens.length > 0)
                                        ? __spreadArray(__spreadArray([], (existingPrefs.muscleLessens || []), true), parsedPreferences.muscleLessens, true) : existingPrefs.muscleLessens,
                                    includeExercises: (parsedPreferences.includeExercises && parsedPreferences.includeExercises.length > 0)
                                        ? __spreadArray(__spreadArray([], (existingPrefs.includeExercises || []), true), parsedPreferences.includeExercises, true) : existingPrefs.includeExercises,
                                    avoidExercises: (parsedPreferences.avoidExercises && parsedPreferences.avoidExercises.length > 0)
                                        ? __spreadArray(__spreadArray([], (existingPrefs.avoidExercises || []), true), parsedPreferences.avoidExercises, true) : existingPrefs.avoidExercises,
                                    avoidJoints: (parsedPreferences.avoidJoints && parsedPreferences.avoidJoints.length > 0)
                                        ? __spreadArray(__spreadArray([], (existingPrefs.avoidJoints || []), true), parsedPreferences.avoidJoints, true) : existingPrefs.avoidJoints,
                                    // Only update sessionGoal if explicitly provided (not undefined)
                                    sessionGoal: parsedPreferences.sessionGoal !== undefined
                                        ? parsedPreferences.sessionGoal
                                        : existingPrefs.sessionGoal,
                                    sessionGoalSource: parsedPreferences.sessionGoal !== undefined
                                        ? 'explicit'
                                        : 'inherited', // If not mentioned in follow-up, it's inherited
                                    needsFollowUp: false, // We're resolving the follow-up
                                    systemPromptUsed: parsedPreferences.systemPromptUsed,
                                    rawLLMResponse: parsedPreferences.rawLLMResponse,
                                    debugInfo: parsedPreferences.debugInfo
                                };
                            }
                            else {
                                // No existing preferences in follow-up, use parsed with defaults
                                mergedPreferences = __assign(__assign({}, parsedPreferences), { intensitySource: parsedPreferences.intensity !== undefined ? 'explicit' : 'default', sessionGoalSource: parsedPreferences.sessionGoal !== undefined ? 'explicit' : 'default' });
                            }
                        }
                        else {
                            // Initial preferences - add source tracking
                            mergedPreferences = __assign(__assign({}, parsedPreferences), { intensitySource: parsedPreferences.intensity !== undefined ? 'explicit' : 'default', sessionGoalSource: parsedPreferences.sessionGoal !== undefined ? 'explicit' : 'default' });
                        }
                        // Log LLM call for preference parsing
                        if (sessionTestDataLogger_1.sessionTestDataLogger.isEnabled()) {
                            sessionTestDataLogger_1.sessionTestDataLogger.logLLMCall(preferenceCheck.trainingSessionId, {
                                type: 'preference_parsing',
                                model: 'gpt-4o-mini',
                                systemPrompt: parsedPreferences.systemPromptUsed || 'Not available',
                                userInput: messageContent,
                                rawResponse: parsedPreferences.rawLLMResponse,
                                parsedResponse: parsedPreferences,
                                parseTimeMs: parseTime,
                                error: ((_b = parsedPreferences.debugInfo) === null || _b === void 0 ? void 0 : _b.error) ? JSON.stringify(parsedPreferences.debugInfo.error) : undefined
                            });
                        }
                        // Save simple preferences immediately (fire-and-forget)
                        workoutPreferenceService_1.WorkoutPreferenceService.saveSimplePreferences(preferenceCheck.userId, preferenceCheck.trainingSessionId, preferenceCheck.businessId, mergedPreferences).catch(function (error) {
                            logger.error("Failed to save simple preferences (non-blocking)", error);
                        });
                        validatedPreferences = __assign({}, mergedPreferences);
                        exerciseValidationInfo = {};
                        newAvoidExercises = parsedPreferences.avoidExercises || [];
                        newIncludeExercises = parsedPreferences.includeExercises || [];
                        logger.info("Exercise arrays from parsed preferences", {
                            newAvoidExercises: newAvoidExercises,
                            newIncludeExercises: newIncludeExercises,
                            currentStep: preferenceCheck.currentStep,
                            hasExistingPrefs: !!existingPrefs
                        });
                        // Clear exercise arrays from validatedPreferences if we're going to validate them
                        // to avoid duplicates when merging
                        if (newAvoidExercises.length > 0) {
                            validatedPreferences.avoidExercises = (existingPrefs === null || existingPrefs === void 0 ? void 0 : existingPrefs.avoidExercises) || [];
                        }
                        if (newIncludeExercises.length > 0) {
                            validatedPreferences.includeExercises = (existingPrefs === null || existingPrefs === void 0 ? void 0 : existingPrefs.includeExercises) || [];
                        }
                        if (!(newAvoidExercises.length > 0 || newIncludeExercises.length > 0)) return [3 /*break*/, 13];
                        logger.info("Starting exercise validation for NEW exercises only", {
                            newAvoidExercises: newAvoidExercises,
                            newIncludeExercises: newIncludeExercises,
                            businessId: preferenceCheck.businessId
                        });
                        _g.label = 4;
                    case 4:
                        _g.trys.push([4, 12, , 13]);
                        filteredIncludes = void 0;
                        existingIncludes = (existingPrefs === null || existingPrefs === void 0 ? void 0 : existingPrefs.includeExercises) || [];
                        if (!(newAvoidExercises.length > 0)) return [3 /*break*/, 6];
                        return [4 /*yield*/, exerciseValidationService_1.ExerciseValidationService.validateExercises(newAvoidExercises, preferenceCheck.businessId, "avoid", preferenceCheck.trainingSessionId)];
                    case 5:
                        avoidValidation = _g.sent();
                        validatedAvoidsLower_1 = avoidValidation.validatedExercises.map(function (e) { return e.toLowerCase(); });
                        filteredIncludes = existingIncludes.filter(function (exercise) { return !validatedAvoidsLower_1.includes(exercise.toLowerCase()); });
                        // Update both lists
                        validatedPreferences.includeExercises = filteredIncludes;
                        validatedPreferences.avoidExercises = __spreadArray(__spreadArray([], ((existingPrefs === null || existingPrefs === void 0 ? void 0 : existingPrefs.avoidExercises) || []), true), avoidValidation.validatedExercises, true);
                        exerciseValidationInfo.avoidExercises = avoidValidation;
                        logger.info("NEW avoid exercises validation result", {
                            input: newAvoidExercises,
                            validated: avoidValidation.validatedExercises,
                            matches: avoidValidation.matches,
                            removedFromIncludes: existingIncludes.length - ((filteredIncludes === null || filteredIncludes === void 0 ? void 0 : filteredIncludes.length) || 0)
                        });
                        _g.label = 6;
                    case 6:
                        if (!(newIncludeExercises.length > 0)) return [3 /*break*/, 11];
                        return [4 /*yield*/, exerciseValidationService_1.ExerciseValidationService.validateExercises(newIncludeExercises, preferenceCheck.businessId, "include", preferenceCheck.trainingSessionId)];
                    case 7:
                        includeValidation = _g.sent();
                        logger.info("Include validation result", {
                            newIncludeExercises: newIncludeExercises,
                            validationResult: {
                                validatedExercises: includeValidation.validatedExercises,
                                matchesCount: includeValidation.matches.length,
                                matches: includeValidation.matches
                            }
                        });
                        ambiguousMatches = includeValidation.matches.filter(function (match) { return match.matchedExercises && match.matchedExercises.length > 1; });
                        logger.info("Checking for disambiguation in follow-up", {
                            includeValidationMatches: includeValidation.matches.map(function (m) { return ({
                                userInput: m.userInput,
                                matchCount: m.matchedExercises.length,
                                matches: m.matchedExercises.map(function (e) { return e.name; })
                            }); }),
                            ambiguousMatchesCount: ambiguousMatches.length,
                            currentStep: preferenceCheck.currentStep
                        });
                        if (!(ambiguousMatches.length > 0)) return [3 /*break*/, 10];
                        logger.info("Disambiguation needed - returning disambiguation message", {
                            ambiguousMatchesCount: ambiguousMatches.length,
                            userId: preferenceCheck.userId
                        });
                        if (!(((_c = validatedPreferences.avoidExercises) === null || _c === void 0 ? void 0 : _c.length) || filteredIncludes)) return [3 /*break*/, 9];
                        preDisambiguationSave = {};
                        if ((_d = validatedPreferences.avoidExercises) === null || _d === void 0 ? void 0 : _d.length) {
                            preDisambiguationSave.avoidExercises = validatedPreferences.avoidExercises;
                        }
                        // If we filtered includes due to conflicts, save the filtered version
                        if (filteredIncludes && filteredIncludes.length !== existingIncludes.length) {
                            preDisambiguationSave.includeExercises = filteredIncludes;
                        }
                        return [4 /*yield*/, workoutPreferenceService_1.WorkoutPreferenceService.savePreferences(preferenceCheck.userId, preferenceCheck.trainingSessionId, preferenceCheck.businessId, preDisambiguationSave, "initial_collected")];
                    case 8:
                        _g.sent();
                        logger.info("Saved avoid exercises and filtered includes before disambiguation", {
                            userId: preferenceCheck.userId,
                            avoidExercises: validatedPreferences.avoidExercises,
                            filteredIncludes: filteredIncludes,
                            removedFromIncludes: existingIncludes.length - ((filteredIncludes === null || filteredIncludes === void 0 ? void 0 : filteredIncludes.length) || 0)
                        });
                        _g.label = 9;
                    case 9: 
                    // Handle disambiguation needed
                    return [2 /*return*/, this.handleDisambiguationNeeded(preferenceCheck, phoneNumber, messageSid, messageContent, ambiguousMatches, mergedPreferences, parseTime, exerciseValidationInfo)];
                    case 10:
                        currentIncludes = validatedPreferences.includeExercises !== undefined
                            ? validatedPreferences.includeExercises
                            : ((existingPrefs === null || existingPrefs === void 0 ? void 0 : existingPrefs.includeExercises) || []);
                        validatedPreferences.includeExercises = __spreadArray(__spreadArray([], currentIncludes, true), includeValidation.validatedExercises, true);
                        exerciseValidationInfo.includeExercises = includeValidation;
                        logger.info("NEW include exercises validation result", {
                            input: newIncludeExercises,
                            validated: includeValidation.validatedExercises,
                            matches: includeValidation.matches,
                            finalMerged: validatedPreferences.includeExercises
                        });
                        _g.label = 11;
                    case 11: return [3 /*break*/, 13];
                    case 12:
                        error_1 = _g.sent();
                        logger.error("Exercise validation error", {
                            error: error_1 instanceof Error ? error_1.message : error_1,
                            stack: error_1 instanceof Error ? error_1.stack : undefined,
                            currentStep: preferenceCheck.currentStep,
                            newIncludeExercises: newIncludeExercises,
                            newAvoidExercises: newAvoidExercises
                        });
                        return [3 /*break*/, 13];
                    case 13: return [4 /*yield*/, this.determineNextStep(preferenceCheck.currentStep, validatedPreferences)];
                    case 14:
                        _a = _g.sent(), nextStep = _a.nextStep, response = _a.response;
                        // Save preferences
                        logger.info("About to save preferences", {
                            userId: preferenceCheck.userId,
                            sessionId: preferenceCheck.trainingSessionId,
                            validatedPreferences: __assign(__assign({}, validatedPreferences), { avoidExercisesCount: ((_e = validatedPreferences.avoidExercises) === null || _e === void 0 ? void 0 : _e.length) || 0, includeExercisesCount: ((_f = validatedPreferences.includeExercises) === null || _f === void 0 ? void 0 : _f.length) || 0 })
                        });
                        return [4 /*yield*/, workoutPreferenceService_1.WorkoutPreferenceService.savePreferences(preferenceCheck.userId, preferenceCheck.trainingSessionId, preferenceCheck.businessId, validatedPreferences, nextStep)];
                    case 15:
                        _g.sent();
                        // Save messages
                        return [4 /*yield*/, this.saveMessages(phoneNumber, messageContent, response, messageSid, preferenceCheck, validatedPreferences, parseTime, nextStep, exerciseValidationInfo)];
                    case 16:
                        // Save messages
                        _g.sent();
                        if (!sessionTestDataLogger_1.sessionTestDataLogger.isEnabled()) return [3 /*break*/, 18];
                        sessionTestDataLogger_1.sessionTestDataLogger.logMessage(preferenceCheck.trainingSessionId, {
                            direction: 'outbound',
                            content: response,
                            metadata: {
                                nextStep: nextStep,
                                validatedPreferences: validatedPreferences
                            }
                        });
                        // Save the complete session data
                        return [4 /*yield*/, sessionTestDataLogger_1.sessionTestDataLogger.saveSessionData(preferenceCheck.trainingSessionId)];
                    case 17:
                        // Save the complete session data
                        _g.sent();
                        _g.label = 18;
                    case 18:
                        logger.info("Preference response complete", {
                            userId: preferenceCheck.userId,
                            needsFollowUp: mergedPreferences.needsFollowUp,
                            nextStep: nextStep
                        });
                        return [2 /*return*/, {
                                success: true,
                                message: response,
                                metadata: {
                                    userId: preferenceCheck.userId,
                                    businessId: preferenceCheck.businessId,
                                    sessionId: preferenceCheck.trainingSessionId,
                                    nextStep: nextStep,
                                    parseTime: parseTime
                                }
                            }];
                    case 19:
                        error_2 = _g.sent();
                        logger.error("Preference handler error", error_2);
                        throw error_2;
                    case 20: return [2 /*return*/];
                }
            });
        });
    };
    PreferenceHandler.prototype.determineNextStep = function (currentStep, validatedPreferences) {
        return __awaiter(this, void 0, void 0, function () {
            var nextStep, response, followupResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(currentStep === "not_started" || currentStep === "disambiguation_resolved")) return [3 /*break*/, 2];
                        return [4 /*yield*/, targetedFollowupService_1.TargetedFollowupService.generateFollowup(currentStep, validatedPreferences)];
                    case 1:
                        followupResult = _a.sent();
                        nextStep = "followup_sent";
                        response = followupResult.followupQuestion;
                        logger.info("Generated targeted follow-up", {
                            fieldsAsked: followupResult.fieldsAsked,
                            currentStep: currentStep
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        if (currentStep === "followup_sent") {
                            // They've answered the follow-up
                            nextStep = "preferences_active";
                            response = targetedFollowupService_1.TargetedFollowupService.generateFinalResponse();
                        }
                        else {
                            // Default response
                            nextStep = "followup_sent";
                            response = "Got it! What's your training focus today, and any specific areas you'd like to work on?";
                        }
                        _a.label = 3;
                    case 3: return [2 /*return*/, { nextStep: nextStep, response: response }];
                }
            });
        });
    };
    PreferenceHandler.prototype.handleDisambiguationNeeded = function (preferenceCheck, phoneNumber, messageSid, messageContent, ambiguousMatches, parsedPreferences, parseTime, exerciseValidationInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var userInfo, disambiguationMessage, optionNumber, allOptions, _i, ambiguousMatches_1, match, _a, _b, exercise, llmCalls_1, allMatches, error_3;
            var _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 7, , 8]);
                        return [4 /*yield*/, (0, checkInService_1.getUserByPhone)(phoneNumber)];
                    case 1:
                        userInfo = _e.sent();
                        if (!userInfo) {
                            throw new Error("User not found");
                        }
                        disambiguationMessage = "I found multiple exercises matching your request. Please select by number:\n\n";
                        optionNumber = 1;
                        allOptions = [];
                        for (_i = 0, ambiguousMatches_1 = ambiguousMatches; _i < ambiguousMatches_1.length; _i++) {
                            match = ambiguousMatches_1[_i];
                            disambiguationMessage += "For \"".concat(match.userInput, "\":\n");
                            // Show all exercise options
                            for (_a = 0, _b = match.matchedExercises; _a < _b.length; _a++) {
                                exercise = _b[_a];
                                disambiguationMessage += "".concat(optionNumber, ". ").concat(exercise.name, "\n");
                                allOptions.push(exercise);
                                optionNumber++;
                            }
                            disambiguationMessage += "\n";
                        }
                        disambiguationMessage += "Reply with number(s) (e.g., '1' or '1,3')";
                        if (!sessionTestDataLogger_1.sessionTestDataLogger.isEnabled()) return [3 /*break*/, 3];
                        sessionTestDataLogger_1.sessionTestDataLogger.logMessage(preferenceCheck.trainingSessionId, {
                            direction: 'outbound',
                            content: disambiguationMessage,
                            metadata: {
                                type: 'disambiguation_request',
                                ambiguousMatches: ambiguousMatches,
                                options: allOptions
                            }
                        });
                        // Save session data up to this point
                        return [4 /*yield*/, sessionTestDataLogger_1.sessionTestDataLogger.saveSessionData(preferenceCheck.trainingSessionId)];
                    case 2:
                        // Save session data up to this point
                        _e.sent();
                        _e.label = 3;
                    case 3: 
                    // Save conversation state
                    return [4 /*yield*/, conversationStateService_1.ConversationStateService.createExerciseDisambiguation(userInfo.userId, preferenceCheck.trainingSessionId, preferenceCheck.businessId, ambiguousMatches.map(function (m) { return m.userInput; }).join(", "), allOptions)];
                    case 4:
                        // Save conversation state
                        _e.sent();
                        // Save the messages
                        return [4 /*yield*/, (0, messageService_1.saveMessage)({
                                userId: userInfo.userId,
                                businessId: userInfo.businessId,
                                direction: 'inbound',
                                content: messageContent,
                                phoneNumber: phoneNumber,
                                metadata: {
                                    type: 'preference_collection',
                                    requiresDisambiguation: true,
                                    twilioMessageSid: messageSid,
                                },
                                status: 'delivered',
                            })];
                    case 5:
                        // Save the messages
                        _e.sent();
                        llmCalls_1 = [];
                        // Add preference parsing LLM call
                        llmCalls_1.push({
                            type: 'preference_parsing',
                            model: 'gpt-4o-mini',
                            systemPrompt: parsedPreferences.systemPromptUsed || 'Not available',
                            userInput: messageContent,
                            rawResponse: parsedPreferences.rawLLMResponse || parsedPreferences,
                            parsedResponse: parsedPreferences,
                            parseTimeMs: parseTime
                        });
                        allMatches = __spreadArray(__spreadArray([], (((_c = exerciseValidationInfo.avoidExercises) === null || _c === void 0 ? void 0 : _c.matches) || []), true), (((_d = exerciseValidationInfo.includeExercises) === null || _d === void 0 ? void 0 : _d.matches) || []), true);
                        allMatches.forEach(function (match) {
                            if (match.matchMethod === 'llm') {
                                llmCalls_1.push({
                                    type: 'exercise_matching',
                                    model: match.model || 'gpt-4o-mini',
                                    systemPrompt: match.systemPrompt || 'Not available',
                                    userInput: match.userInput,
                                    rawResponse: match.llmReasoning || { reasoning: match.llmReasoning },
                                    matchedExercises: match.matchedExercises,
                                    parseTimeMs: match.parseTimeMs || 0
                                });
                            }
                        });
                        return [4 /*yield*/, (0, messageService_1.saveMessage)({
                                userId: userInfo.userId,
                                businessId: userInfo.businessId,
                                direction: 'outbound',
                                content: disambiguationMessage,
                                phoneNumber: phoneNumber,
                                metadata: {
                                    type: 'disambiguation_request',
                                    optionCount: allOptions.length,
                                    // Include llmCalls array for consistency
                                    llmCalls: llmCalls_1,
                                    // Keep llmParsing for backward compatibility
                                    llmParsing: {
                                        model: 'gpt-4o-mini',
                                        parseTimeMs: parseTime,
                                        inputLength: messageContent.length,
                                        parsedData: parsedPreferences,
                                        rawLLMResponse: parsedPreferences.rawLLMResponse || null,
                                        systemPrompt: parsedPreferences.systemPromptUsed || 'Not available',
                                        debugInfo: parsedPreferences.debugInfo || null,
                                        userInput: messageContent,
                                        extractedFields: {
                                            intensity: parsedPreferences.intensity || null,
                                            muscleTargets: parsedPreferences.muscleTargets || [],
                                            muscleLessens: parsedPreferences.muscleLessens || [],
                                            includeExercises: parsedPreferences.includeExercises || [],
                                            avoidExercises: parsedPreferences.avoidExercises || [],
                                            avoidJoints: parsedPreferences.avoidJoints || [],
                                            sessionGoal: parsedPreferences.sessionGoal || null,
                                            generalNotes: parsedPreferences.generalNotes || null,
                                            needsFollowUp: parsedPreferences.needsFollowUp || false,
                                        },
                                        exerciseValidation: __assign(__assign({}, exerciseValidationInfo), { ambiguousMatches: ambiguousMatches.map(function (match) { return ({
                                                userInput: match.userInput,
                                                matchedExercises: match.matchedExercises,
                                                confidence: match.confidence,
                                                matchMethod: match.matchMethod,
                                                model: match.model || 'gpt-4o-mini',
                                                parseTimeMs: match.parseTimeMs,
                                                llmReasoning: match.llmReasoning,
                                                systemPrompt: match.systemPrompt,
                                                matchCount: match.matchedExercises.length
                                            }); }) })
                                    },
                                    // Also store ambiguousMatches at top level
                                    ambiguousMatches: ambiguousMatches,
                                    exerciseValidation: exerciseValidationInfo
                                },
                                status: 'sent',
                            })];
                    case 6:
                        _e.sent();
                        logger.info("Disambiguation required", {
                            userId: userInfo.userId,
                            ambiguousCount: ambiguousMatches.length,
                            totalOptions: allOptions.length
                        });
                        return [2 /*return*/, {
                                success: true,
                                message: disambiguationMessage,
                                metadata: {
                                    userId: userInfo.userId,
                                    businessId: userInfo.businessId,
                                    requiresDisambiguation: true
                                }
                            }];
                    case 7:
                        error_3 = _e.sent();
                        logger.error("Error handling disambiguation", error_3);
                        throw error_3;
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    PreferenceHandler.prototype.saveMessages = function (phoneNumber, inboundContent, outboundContent, messageSid, preferenceCheck, parsedPreferences, parseTime, nextStep, exerciseValidationInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var userInfo, llmCalls_2, allMatches, error_4;
            var _a, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        _h.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, (0, checkInService_1.getUserByPhone)(phoneNumber)];
                    case 1:
                        userInfo = _h.sent();
                        if (!userInfo) {
                            logger.warn("User not found for message saving", { phoneNumber: phoneNumber });
                            return [2 /*return*/];
                        }
                        // Save inbound preference message
                        return [4 /*yield*/, (0, messageService_1.saveMessage)({
                                userId: userInfo.userId,
                                businessId: userInfo.businessId,
                                direction: 'inbound',
                                content: inboundContent,
                                phoneNumber: phoneNumber,
                                metadata: {
                                    type: 'preference_collection',
                                    step: preferenceCheck.currentStep,
                                    twilioMessageSid: messageSid,
                                },
                                status: 'delivered',
                            })];
                    case 2:
                        // Save inbound preference message
                        _h.sent();
                        llmCalls_2 = [];
                        // First LLM call - preference parsing
                        llmCalls_2.push({
                            model: 'gpt-4o-mini',
                            parseTimeMs: parseTime,
                            inputLength: inboundContent.length,
                            parsedData: parsedPreferences,
                            rawLLMResponse: parsedPreferences.rawLLMResponse || null,
                            systemPrompt: parsedPreferences.systemPromptUsed || 'Not available',
                            debugInfo: parsedPreferences.debugInfo || null,
                            extractedFields: {
                                intensity: parsedPreferences.intensity || null,
                                muscleTargets: parsedPreferences.muscleTargets || [],
                                muscleLessens: parsedPreferences.muscleLessens || [],
                                includeExercises: parsedPreferences.includeExercises || [],
                                avoidExercises: parsedPreferences.avoidExercises || [],
                                avoidJoints: parsedPreferences.avoidJoints || [],
                                sessionGoal: parsedPreferences.sessionGoal || null,
                                generalNotes: parsedPreferences.generalNotes || null,
                                needsFollowUp: parsedPreferences.needsFollowUp || false,
                            },
                            userInput: inboundContent,
                            confidenceIndicators: {
                                hasIntensity: !!parsedPreferences.intensity,
                                hasMuscleTargets: !!((_a = parsedPreferences.muscleTargets) === null || _a === void 0 ? void 0 : _a.length),
                                hasRestrictions: !!(((_b = parsedPreferences.muscleLessens) === null || _b === void 0 ? void 0 : _b.length) || ((_c = parsedPreferences.avoidJoints) === null || _c === void 0 ? void 0 : _c.length)),
                                hasSpecificRequests: !!(((_d = parsedPreferences.includeExercises) === null || _d === void 0 ? void 0 : _d.length) || ((_e = parsedPreferences.avoidExercises) === null || _e === void 0 ? void 0 : _e.length)),
                                requiresFollowUp: parsedPreferences.needsFollowUp || false,
                            }
                        });
                        allMatches = __spreadArray(__spreadArray([], (((_f = exerciseValidationInfo.avoidExercises) === null || _f === void 0 ? void 0 : _f.matches) || []), true), (((_g = exerciseValidationInfo.includeExercises) === null || _g === void 0 ? void 0 : _g.matches) || []), true);
                        allMatches.forEach(function (match, index) {
                            var _a, _b;
                            if (match.matchMethod === 'llm' && match.llmReasoning) {
                                llmCalls_2.push({
                                    model: 'gpt-4o-mini',
                                    parseTimeMs: match.parseTimeMs,
                                    exerciseMatch: {
                                        userInput: match.userInput,
                                        matchMethod: match.matchMethod,
                                        matchCount: ((_a = match.matchedExercises) === null || _a === void 0 ? void 0 : _a.length) || 0,
                                        matches: ((_b = match.matchedExercises) === null || _b === void 0 ? void 0 : _b.map(function (ex) { return ex.name; })) || [],
                                        reasoning: match.llmReasoning
                                    }
                                });
                            }
                        });
                        // Save outbound response with all LLM calls
                        return [4 /*yield*/, (0, messageService_1.saveMessage)({
                                userId: userInfo.userId,
                                businessId: userInfo.businessId,
                                direction: 'outbound',
                                content: outboundContent,
                                phoneNumber: phoneNumber,
                                metadata: {
                                    type: 'preference_collection_response',
                                    step: nextStep,
                                    // Primary LLM parsing (for backward compatibility)
                                    llmParsing: llmCalls_2[0],
                                    // All LLM calls as array
                                    llmCalls: llmCalls_2,
                                    // Exercise validation summary
                                    exerciseValidation: exerciseValidationInfo || null
                                },
                                status: 'sent',
                            })];
                    case 3:
                        // Save outbound response with all LLM calls
                        _h.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_4 = _h.sent();
                        logger.error("Failed to save messages", error_4);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return PreferenceHandler;
}());
exports.PreferenceHandler = PreferenceHandler;
