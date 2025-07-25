"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TargetedFollowupService = void 0;
var openai_1 = require("openai");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.createLogger)("TargetedFollowupService");
// Lazy initialization to avoid errors in tests
var openai = null;
function getOpenAIClient() {
    if (!openai) {
        openai = new openai_1.default({
            apiKey: process.env.OPENAI_API_KEY || 'test-key',
        });
    }
    return openai;
}
var TargetedFollowupService = /** @class */ (function () {
    function TargetedFollowupService() {
    }
    /**
     * Determines which fields to ask about based on priority and what's missing
     */
    TargetedFollowupService.determineFieldsToAsk = function (preferences) {
        var fieldsToAsk = [];
        // Priority 1: Always ask for sessionGoal if missing
        if (!preferences.sessionGoal) {
            fieldsToAsk.push('sessionGoal');
        }
        // If we already have 1 field, pick 1 more. If we have 0, pick 2.
        var additionalFieldsNeeded = fieldsToAsk.length === 0 ? 2 : 1;
        // Priority order for additional fields (excluding intensity which has default)
        var priorityFields = [
            { field: 'muscleTargets', check: function () { var _a; return !((_a = preferences.muscleTargets) === null || _a === void 0 ? void 0 : _a.length); } },
            { field: 'avoidJoints', check: function () { var _a; return !((_a = preferences.avoidJoints) === null || _a === void 0 ? void 0 : _a.length); } },
            { field: 'muscleLessens', check: function () { var _a; return !((_a = preferences.muscleLessens) === null || _a === void 0 ? void 0 : _a.length); } },
            { field: 'includeExercises', check: function () { var _a; return !((_a = preferences.includeExercises) === null || _a === void 0 ? void 0 : _a.length); } },
            { field: 'avoidExercises', check: function () { var _a; return !((_a = preferences.avoidExercises) === null || _a === void 0 ? void 0 : _a.length); } },
        ];
        // Add fields based on priority until we have enough
        for (var _i = 0, priorityFields_1 = priorityFields; _i < priorityFields_1.length; _i++) {
            var _a = priorityFields_1[_i], field = _a.field, check = _a.check;
            if (fieldsToAsk.length < (fieldsToAsk.includes('sessionGoal') ? 2 : additionalFieldsNeeded)) {
                if (check()) {
                    fieldsToAsk.push(field);
                }
            }
        }
        return fieldsToAsk;
    };
    /**
     * Creates a prompt for the LLM to generate a coach-like follow-up question
     */
    TargetedFollowupService.createFollowupPrompt = function (fieldsToAsk, existingPreferences) {
        var _a, _b;
        var fieldDescriptions = {
            sessionGoal: "training focus (strength, endurance, or stability)",
            muscleTargets: "specific muscle groups or areas they want to work on",
            avoidJoints: "any joints they need to protect or be careful with",
            muscleLessens: "muscle groups they want to work less or avoid",
            includeExercises: "specific exercises they want to include",
            avoidExercises: "exercises they want to skip or avoid",
        };
        var fieldsText = fieldsToAsk.map(function (field) { return fieldDescriptions[field]; }).join(' and ');
        // Build context about what we already know
        var knownInfo = [];
        if (existingPreferences.intensity) {
            knownInfo.push("planning a ".concat(existingPreferences.intensity, " intensity workout"));
        }
        if ((_a = existingPreferences.includeExercises) === null || _a === void 0 ? void 0 : _a.length) {
            knownInfo.push("including ".concat(existingPreferences.includeExercises.join(', ')));
        }
        if ((_b = existingPreferences.avoidExercises) === null || _b === void 0 ? void 0 : _b.length) {
            knownInfo.push("avoiding ".concat(existingPreferences.avoidExercises.join(', ')));
        }
        var contextText = knownInfo.length > 0 ? "\n\nContext: We're ".concat(knownInfo.join(' and '), ".") : '';
        return "You are a friendly personal trainer having a conversation with a client who just checked in for their workout session.\n".concat(contextText, "\n\nGenerate a natural, conversational follow-up question that asks about their ").concat(fieldsText, ".\n\nGuidelines:\n- Be warm and conversational, like a real trainer would speak\n- Ask about the fields naturally in ONE question (don't list them separately)\n- Keep it brief - one or two sentences max\n- Don't use formal language or sound robotic\n- Don't mention the field names directly, ask naturally\n- Focus on helping them have a great workout\n\nExamples of good questions:\n- \"Got it! What's your training focus today - strength, endurance, or stability? Also, any specific areas you want to work on?\"\n- \"Perfect! Looking to build strength, work on stability, or improve endurance today? And anything we should be careful with?\"\n- \"Sounds good! What are you hoping to accomplish today, and are there any areas we should focus on or avoid?\"\n\nGenerate only the question, nothing else.");
    };
    /**
     * Generates a targeted follow-up question based on missing preference fields
     */
    TargetedFollowupService.generateFollowup = function (currentState, preferences) {
        return __awaiter(this, void 0, void 0, function () {
            var fieldsToAsk, prompt_1, completion, followupQuestion, error_1;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 2, , 3]);
                        fieldsToAsk = this.determineFieldsToAsk(preferences);
                        // If no fields to ask about, return a confirmation
                        if (fieldsToAsk.length === 0) {
                            return [2 /*return*/, {
                                    followupQuestion: "Perfect! I've got all your preferences. Your workout will be tailored to how you're feeling today. See you in the gym!",
                                    fieldsAsked: [],
                                    promptUsed: "No fields needed - returning confirmation"
                                }];
                        }
                        prompt_1 = this.createFollowupPrompt(fieldsToAsk, preferences);
                        return [4 /*yield*/, getOpenAIClient().chat.completions.create({
                                model: "gpt-3.5-turbo",
                                messages: [
                                    {
                                        role: "system",
                                        content: prompt_1
                                    }
                                ],
                                temperature: 0.7,
                                max_tokens: 100,
                            })];
                    case 1:
                        completion = _d.sent();
                        followupQuestion = ((_c = (_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.trim()) ||
                            "What's your training focus today, and any specific areas you'd like to work on?";
                        logger.info("Generated follow-up question", {
                            fieldsAsked: fieldsToAsk,
                            questionLength: followupQuestion.length
                        });
                        return [2 /*return*/, {
                                followupQuestion: followupQuestion,
                                fieldsAsked: fieldsToAsk,
                                promptUsed: prompt_1
                            }];
                    case 2:
                        error_1 = _d.sent();
                        logger.error("Error generating follow-up question", error_1);
                        // Fallback question if LLM fails
                        return [2 /*return*/, {
                                followupQuestion: "What's your training focus today - strength, endurance, or stability? Also, any specific areas you want to work on?",
                                fieldsAsked: ['sessionGoal', 'muscleTargets'],
                                promptUsed: "Error - using fallback"
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generates the final response after follow-up is answered
     */
    TargetedFollowupService.generateFinalResponse = function () {
        return "Great, thank you for that. If you have anything else to add, let me know.";
    };
    /**
     * Generates response for preference updates in active mode
     */
    TargetedFollowupService.generateUpdateResponse = function (updatedFields) {
        if (updatedFields.length === 0) {
            return "Got it. Let me know if you need any other changes.";
        }
        var fieldNames = {
            intensity: "intensity",
            sessionGoal: "training focus",
            muscleTargets: "target areas",
            muscleLessens: "areas to avoid",
            includeExercises: "exercise selections",
            avoidExercises: "exercises to skip",
            avoidJoints: "joint protection",
        };
        // Special responses for common updates
        if (updatedFields.length === 1) {
            switch (updatedFields[0]) {
                case 'intensity':
                    return "Got it, I've adjusted the intensity. Let me know if you need anything else changed.";
                case 'sessionGoal':
                    return "Perfect, I've updated your training focus. Anything else you'd like to adjust?";
                case 'avoidExercises':
                    return "No problem, I'll make sure to skip those. Let me know if there's anything else.";
                case 'includeExercises':
                    return "Great, I'll add those to your workout. Anything else you'd like to change?";
                case 'avoidJoints':
                    return "Noted - I'll be careful with those areas. Let me know if you need other adjustments.";
            }
        }
        // Multiple field updates
        var updates = updatedFields
            .map(function (field) { return fieldNames[field] || field; })
            .join(" and ");
        return "Updated your ".concat(updates, ". Let me know if you need any other changes.");
    };
    return TargetedFollowupService;
}());
exports.TargetedFollowupService = TargetedFollowupService;
