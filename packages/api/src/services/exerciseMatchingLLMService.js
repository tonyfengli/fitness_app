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
exports.ExerciseMatchingLLMService = void 0;
var openai_1 = require("openai");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.createLogger)("ExerciseMatchingLLMService");
var ExerciseMatchingLLMService = /** @class */ (function () {
    function ExerciseMatchingLLMService() {
        this.openai = new openai_1.default({
            apiKey: process.env.OPENAI_API_KEY || 'test-key',
        });
    }
    /**
     * Match user's exercise phrase to actual exercises in the database
     * Used for preference collection (e.g., "avoid heavy squats")
     */
    ExerciseMatchingLLMService.prototype.matchUserIntent = function (userPhrase, availableExercises, intent) {
        return __awaiter(this, void 0, void 0, function () {
            var exerciseList, systemPrompt, startTime, completion, parseTimeMs, response, result, validExerciseNames_1, validatedMatches, error_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        logger.info("Matching user intent", { userPhrase: userPhrase, intent: intent, exerciseCount: availableExercises.length });
                        exerciseList = this.formatExerciseList(availableExercises);
                        systemPrompt = "You are an expert fitness trainer helping match user exercise preferences to actual exercises in a database.\n\nTASK: Match the user's exercise request to exercises from the provided list using a SYSTEMATIC approach.\n\nAvailable exercises (format: name | primary_muscle | movement_pattern | equipment):\n".concat(exerciseList, "\n\nMATCHING ALGORITHM:\n1. Parse the user input to identify:\n   - Base exercise type (squat, deadlift, press, row, etc.)\n   - Equipment qualifier (heavy, light, barbell, dumbbell, etc.)\n   - Any modifiers (variations, specific types)\n\n2. Apply these matching rules IN ORDER:\n   a) Check movement pattern field (2nd field) for primary matching\n   b) Check exercise name for specific variations\n   c) Apply equipment filters if specified\n\n3. For \"").concat(intent, "\" intent:\n").concat(intent === "avoid" ?
                            "   - Be CONSERVATIVE: Only match exercises that clearly fit\n   - \"squats\" \u2192 ALL exercises with movement_pattern=\"squat\"\n   - \"heavy squats\" \u2192 ONLY barbell exercises with movement_pattern=\"squat\"\n   - \"bench press\" \u2192 exercises with \"bench press\" in name\n   - Match should be restrictive to ensure user avoids all relevant exercises" :
                            "   - Be INCLUSIVE: Return all possible variations for user choice\n   - \"squats\" \u2192 ALL exercises with movement_pattern=\"squat\"\n   - \"deadlifts\" \u2192 ALL exercises with movement_pattern=\"hinge\" AND \"deadlift\" in name\n   - \"presses\" \u2192 exercises with \"press\" in name OR vertical_push/horizontal_push patterns\n   - Give users options to choose from", "\n\nSYSTEMATIC MATCHING RULES:\n\nFor MOVEMENT-BASED requests (squats, lunges, deadlifts, etc.):\n- Primary match: movement_pattern field\n- Secondary match: exercise name contains the term\n- Equipment filter: apply if specified\n\nFor NAME-BASED requests (bench press, pull-ups, etc.):\n- Primary match: exercise name contains the specific term\n- Equipment filter: apply if specified\n\nMOVEMENT PATTERN DEFINITIONS:\n- squat: squat variations (NOT lunges, step-ups)\n- lunge: lunge variations (NOT squats)\n- hinge: deadlifts, RDLs, good mornings, swings\n- horizontal_push: bench press, push-ups\n- vertical_push: overhead press, shoulder press\n- horizontal_pull: rows\n- vertical_pull: pull-ups, pulldowns\n- carry: farmer's carry, suitcase carry\n- core: planks, ab exercises\n\nCRITICAL REQUIREMENTS:\n1. You MUST scan the ENTIRE exercise list\n2. Count exercises as you match them\n3. Do NOT stop early - check every single exercise\n4. Your response must include ALL matching exercises\n\nVERIFICATION CHECKLIST:\nBefore returning results, verify:\n\u25A1 Did I check every exercise in the list?\n\u25A1 Did I apply movement pattern matching correctly?\n\u25A1 Did I include all exercises that match the criteria?\n\u25A1 Is my match count reasonable for this exercise type?\n\nReturn a JSON object:\n{\n  \"matchedExerciseNames\": [\"list all matching exercise names here\"],\n  \"reasoning\": \"explain your matching logic and confirm you checked all exercises\",\n  \"matchCount\": number,\n  \"verificationNotes\": \"confirm you scanned the entire list\"\n}");
                        startTime = Date.now();
                        return [4 /*yield*/, this.openai.chat.completions.create({
                                model: "gpt-4o-mini",
                                messages: [
                                    { role: "system", content: systemPrompt },
                                    { role: "user", content: "User wants to ".concat(intent, ": \"").concat(userPhrase, "\"") }
                                ],
                                response_format: { type: "json_object" },
                                temperature: 0.1,
                                max_tokens: 1500, // Increased to handle larger exercise lists
                            })];
                    case 1:
                        completion = _b.sent();
                        parseTimeMs = Date.now() - startTime;
                        response = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message.content;
                        if (!response) {
                            throw new Error("No response from LLM");
                        }
                        result = JSON.parse(response);
                        result.llmResponse = response; // Store raw response for debugging
                        result.systemPrompt = systemPrompt; // Store the system prompt used
                        result.model = "gpt-4o-mini"; // Store the model used
                        result.parseTimeMs = parseTimeMs; // Store the parse time
                        logger.info("LLM matching complete", {
                            userPhrase: userPhrase,
                            matchCount: result.matchedExerciseNames.length,
                            reasoning: result.reasoning
                        });
                        validExerciseNames_1 = new Set(availableExercises.map(function (e) { return e.name; }));
                        validatedMatches = result.matchedExerciseNames.filter(function (name) {
                            return validExerciseNames_1.has(name);
                        });
                        if (validatedMatches.length !== result.matchedExerciseNames.length) {
                            logger.warn("Some LLM matches were invalid", {
                                returned: result.matchedExerciseNames,
                                validated: validatedMatches
                            });
                        }
                        result.matchedExerciseNames = validatedMatches;
                        return [2 /*return*/, result];
                    case 2:
                        error_1 = _b.sent();
                        logger.error("Error in LLM exercise matching", error_1);
                        return [2 /*return*/, {
                                matchedExerciseNames: [],
                                reasoning: "Error during LLM matching"
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Find replacement exercises based on user's reason
     * This will be used for the future exercise swap feature
     */
    ExerciseMatchingLLMService.prototype.findReplacements = function (exerciseToReplace, reason, availableExercises, userNote) {
        return __awaiter(this, void 0, void 0, function () {
            var exerciseList, originalExercise, reasonContext, systemPrompt, completion, response, result, error_2;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 2, , 3]);
                        logger.info("Finding replacements", {
                            exerciseToReplace: exerciseToReplace,
                            reason: reason,
                            userNote: userNote,
                            exerciseCount: availableExercises.length
                        });
                        exerciseList = this.formatExerciseList(availableExercises);
                        originalExercise = availableExercises.find(function (e) { return e.name === exerciseToReplace; });
                        if (!originalExercise) {
                            logger.warn("Original exercise not found", { exerciseToReplace: exerciseToReplace });
                            return [2 /*return*/, []];
                        }
                        reasonContext = this.getReasonContext(reason, userNote);
                        systemPrompt = "You are an expert fitness trainer helping find exercise replacements.\n\nOriginal exercise to replace: ".concat(exerciseToReplace, "\nExercise details: \n- Primary muscle: ").concat(originalExercise.primaryMuscle, "\n- Movement pattern: ").concat(originalExercise.movementPattern, "\n- Equipment: ").concat(((_a = originalExercise.equipment) === null || _a === void 0 ? void 0 : _a.join(", ")) || "none", "\n- Complexity: ").concat(originalExercise.complexityLevel, "\n\nReason for replacement: ").concat(reasonContext, "\n\nAvailable exercises:\n").concat(exerciseList, "\n\nREPLACEMENT GUIDELINES:\n1. For \"too_hard\": Find easier variations with same movement pattern or primary muscle\n2. For \"too_easy\": Find harder progressions that build on the same pattern\n3. For \"avoid_exercise\": Find alternatives that work similar muscles but different movement\n4. For \"no_equipment\": Find variations that match user's available equipment\n5. For \"injury_concern\": Prioritize joint-friendly alternatives\n\nReturn 3-5 suggestions as JSON:\n{\n  \"suggestions\": [\n    {\n      \"exerciseName\": \"exact name from list\",\n      \"reasoning\": \"why this is a good replacement\",\n      \"matchQuality\": \"exact|similar|alternative\"\n    }\n  ]\n}");
                        return [4 /*yield*/, this.openai.chat.completions.create({
                                model: "gpt-4o-mini",
                                messages: [
                                    { role: "system", content: systemPrompt },
                                    { role: "user", content: "Find replacements for ".concat(exerciseToReplace) }
                                ],
                                response_format: { type: "json_object" },
                                temperature: 0.5,
                                max_tokens: 800,
                            })];
                    case 1:
                        completion = _d.sent();
                        response = (_b = completion.choices[0]) === null || _b === void 0 ? void 0 : _b.message.content;
                        if (!response) {
                            throw new Error("No response from LLM");
                        }
                        result = JSON.parse(response);
                        logger.info("Replacement suggestions generated", {
                            exerciseToReplace: exerciseToReplace,
                            suggestionCount: ((_c = result.suggestions) === null || _c === void 0 ? void 0 : _c.length) || 0
                        });
                        return [2 /*return*/, result.suggestions || []];
                    case 2:
                        error_2 = _d.sent();
                        logger.error("Error finding replacements", error_2);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Format exercise list for LLM context
     */
    ExerciseMatchingLLMService.prototype.formatExerciseList = function (exercises) {
        return exercises
            .map(function (ex) { var _a; return "- ".concat(ex.name, " | ").concat(ex.primaryMuscle, " | ").concat(ex.movementPattern || "unspecified", " | ").concat(((_a = ex.equipment) === null || _a === void 0 ? void 0 : _a.join("/")) || "bodyweight"); })
            .join("\n");
    };
    /**
     * Get context string for replacement reason
     */
    ExerciseMatchingLLMService.prototype.getReasonContext = function (reason, userNote) {
        var contexts = {
            too_hard: "User finds this exercise too difficult or challenging",
            too_easy: "User wants a more challenging variation",
            avoid_exercise: "User wants to avoid this specific exercise",
            no_equipment: "User doesn't have the required equipment",
            injury_concern: "User has injury or pain concerns",
            other: "User has a specific reason"
        };
        var context = contexts[reason];
        if (userNote) {
            context += ". User note: \"".concat(userNote, "\"");
        }
        return context;
    };
    return ExerciseMatchingLLMService;
}());
exports.ExerciseMatchingLLMService = ExerciseMatchingLLMService;
