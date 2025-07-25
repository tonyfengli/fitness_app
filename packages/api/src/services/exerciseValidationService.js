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
exports.ExerciseValidationService = void 0;
var client_1 = require("@acme/db/client");
var schema_1 = require("@acme/db/schema");
var db_1 = require("@acme/db");
var logger_1 = require("../utils/logger");
var hybridExerciseMatcherService_1 = require("./hybridExerciseMatcherService");
var sessionTestDataLogger_1 = require("../utils/sessionTestDataLogger");
var logger = (0, logger_1.createLogger)("ExerciseValidationService");
var ExerciseValidationService = /** @class */ (function () {
    function ExerciseValidationService() {
    }
    /**
     * Validate and match exercise names from user input to actual exercises in the database
     */
    ExerciseValidationService.validateExercises = function (userInputExercises_1, businessId_1) {
        return __awaiter(this, arguments, void 0, function (userInputExercises, businessId, intent, sessionId) {
            var matches, validatedExercises, businessExercises, matchPromises, matchResults, hasUnrecognized, totalParseTime, model;
            var _this = this;
            var _a;
            if (intent === void 0) { intent = "avoid"; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        logger.info("Starting exercise validation", {
                            userInputExercises: userInputExercises,
                            businessId: businessId
                        });
                        if (!userInputExercises || userInputExercises.length === 0) {
                            return [2 /*return*/, {
                                    validatedExercises: [],
                                    matches: [],
                                    hasUnrecognized: false,
                                }];
                        }
                        matches = [];
                        validatedExercises = [];
                        return [4 /*yield*/, client_1.db
                                .select({
                                id: schema_1.exercises.id,
                                name: schema_1.exercises.name,
                                exerciseType: schema_1.exercises.exerciseType,
                                primaryMuscle: schema_1.exercises.primaryMuscle,
                                equipment: schema_1.exercises.equipment,
                                movementPattern: schema_1.exercises.movementPattern,
                                complexityLevel: schema_1.exercises.complexityLevel,
                            })
                                .from(schema_1.exercises)
                                .innerJoin(schema_1.BusinessExercise, (0, db_1.eq)(schema_1.exercises.id, schema_1.BusinessExercise.exerciseId))
                                .where((0, db_1.eq)(schema_1.BusinessExercise.businessId, businessId))];
                    case 1:
                        businessExercises = _b.sent();
                        matchPromises = userInputExercises.map(function (userInput) { return __awaiter(_this, void 0, void 0, function () {
                            var matchResult, matcherCall, error_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, ExerciseValidationService.hybridMatcher.matchExercises(userInput, businessExercises, intent)];
                                    case 1:
                                        matchResult = _a.sent();
                                        logger.info("Hybrid matcher result", {
                                            userInput: userInput,
                                            matchMethod: matchResult.matchMethod,
                                            matchCount: matchResult.matchedExercises.length,
                                            matchedNames: matchResult.matchedExerciseNames,
                                            parseTimeMs: matchResult.parseTimeMs
                                        });
                                        // Log exercise matcher call if session logging is enabled
                                        if (sessionId && sessionTestDataLogger_1.sessionTestDataLogger.isEnabled()) {
                                            matcherCall = {
                                                userPhrase: userInput,
                                                intent: intent,
                                                matchMethod: matchResult.matchMethod,
                                                matchedExercises: matchResult.matchedExerciseNames,
                                                parseTimeMs: matchResult.parseTimeMs || 0
                                            };
                                            // If LLM was used, include the LLM details
                                            if (matchResult.matchMethod === 'llm' && matchResult.systemPrompt) {
                                                matcherCall.llmFallback = {
                                                    systemPrompt: matchResult.systemPrompt,
                                                    rawResponse: matchResult.llmResponse || matchResult.reasoning,
                                                    reasoning: matchResult.reasoning || ''
                                                };
                                                // Also log as a separate LLM call
                                                sessionTestDataLogger_1.sessionTestDataLogger.logLLMCall(sessionId, {
                                                    type: 'exercise_matching',
                                                    model: matchResult.model || 'gpt-4o-mini',
                                                    systemPrompt: matchResult.systemPrompt,
                                                    userInput: userInput,
                                                    rawResponse: matchResult.llmResponse || matchResult.reasoning,
                                                    parseTimeMs: matchResult.parseTimeMs || 0
                                                });
                                            }
                                            sessionTestDataLogger_1.sessionTestDataLogger.logExerciseMatcherCall(sessionId, matcherCall);
                                        }
                                        return [2 /*return*/, {
                                                userInput: userInput,
                                                matchedExercises: matchResult.matchedExercises,
                                                confidence: matchResult.matchedExercises.length > 0 ? (matchResult.matchMethod === "llm" ? "llm_match" : matchResult.matchMethod) : "no_match",
                                                matchMethod: matchResult.matchMethod,
                                                llmReasoning: matchResult.reasoning,
                                                systemPrompt: matchResult.systemPrompt,
                                                model: matchResult.model,
                                                parseTimeMs: matchResult.parseTimeMs,
                                                matchedExerciseNames: matchResult.matchedExerciseNames
                                            }];
                                    case 2:
                                        error_1 = _a.sent();
                                        logger.error("Exercise matching failed for input", { userInput: userInput, error: error_1 });
                                        return [2 /*return*/, {
                                                userInput: userInput,
                                                matchedExercises: [],
                                                confidence: "no_match",
                                                matchedExerciseNames: []
                                            }];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                        return [4 /*yield*/, Promise.all(matchPromises)];
                    case 2:
                        matchResults = _b.sent();
                        // Process results
                        matchResults.forEach(function (result) {
                            matches.push({
                                userInput: result.userInput,
                                matchedExercises: result.matchedExercises,
                                confidence: result.confidence,
                                matchMethod: result.matchMethod,
                                llmReasoning: result.llmReasoning,
                                parseTimeMs: result.parseTimeMs
                            });
                            // Add all matched exercise names
                            validatedExercises.push.apply(validatedExercises, result.matchedExerciseNames);
                        });
                        hasUnrecognized = matches.some(function (m) { return m.confidence === "no_match"; });
                        logger.info("Exercise validation complete", {
                            inputCount: userInputExercises.length,
                            validatedCount: validatedExercises.length,
                            hasUnrecognized: hasUnrecognized,
                        });
                        totalParseTime = matches.reduce(function (sum, match) { return sum + (match.parseTimeMs || 0); }, 0);
                        model = (_a = matches.find(function (m) { return m.model; })) === null || _a === void 0 ? void 0 : _a.model;
                        return [2 /*return*/, {
                                validatedExercises: validatedExercises,
                                matches: matches,
                                hasUnrecognized: hasUnrecognized,
                                model: model,
                                parseTimeMs: totalParseTime
                            }];
                }
            });
        });
    };
    /**
     * [DEPRECATED - Kept for reference]
     * Find the best match for a user input exercise name using fuzzy matching
     */
    ExerciseValidationService.findBestMatchFuzzy = function (userInput, businessExercises, businessId) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedInput, exactMatch, partialMatches, bestPartialMatch, bestFuzzyMatch;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        normalizedInput = this.normalizeExerciseName(userInput);
                        exactMatch = businessExercises.find(function (ex) { return _this.normalizeExerciseName(ex.name) === normalizedInput; });
                        if (exactMatch) {
                            return [2 /*return*/, {
                                    userInput: userInput,
                                    matchedExercise: exactMatch,
                                    confidence: "exact",
                                }];
                        }
                        return [4 /*yield*/, client_1.db
                                .select({
                                id: schema_1.exercises.id,
                                name: schema_1.exercises.name,
                            })
                                .from(schema_1.exercises)
                                .innerJoin(schema_1.BusinessExercise, (0, db_1.eq)(schema_1.exercises.id, schema_1.BusinessExercise.exerciseId))
                                .where((0, db_1.and)((0, db_1.eq)(schema_1.BusinessExercise.businessId, businessId), (0, db_1.ilike)(schema_1.exercises.name, "%".concat(normalizedInput, "%"))))
                                .limit(5)];
                    case 1:
                        partialMatches = _a.sent();
                        // Score partial matches based on similarity
                        if (partialMatches.length > 0) {
                            bestPartialMatch = this.getBestFuzzyMatch(normalizedInput, partialMatches);
                            if (bestPartialMatch) {
                                return [2 /*return*/, {
                                        userInput: userInput,
                                        matchedExercise: bestPartialMatch,
                                        confidence: "fuzzy",
                                    }];
                            }
                        }
                        bestFuzzyMatch = this.getBestFuzzyMatch(normalizedInput, businessExercises);
                        if (bestFuzzyMatch && this.calculateSimilarity(normalizedInput, bestFuzzyMatch.name) > 0.6) {
                            return [2 /*return*/, {
                                    userInput: userInput,
                                    matchedExercise: bestFuzzyMatch,
                                    confidence: "fuzzy",
                                }];
                        }
                        // No match found
                        return [2 /*return*/, {
                                userInput: userInput,
                                confidence: "no_match",
                            }];
                }
            });
        });
    };
    /**
     * Normalize exercise name for comparison
     */
    ExerciseValidationService.normalizeExerciseName = function (name) {
        return name
            .toLowerCase()
            .trim()
            // Remove common variations
            .replace(/\s*\([^)]*\)/g, '') // Remove parentheses content
            .replace(/^(the|a|an)\s+/i, '') // Remove articles
            .replace(/\s+/g, ' ') // Normalize whitespace
            // Remove intensity modifiers that users might add
            .replace(/^(heavy|light|medium|hard|easy)\s+/i, '')
            .replace(/\s+(heavy|light|medium|hard|easy)$/i, '')
            // Common exercise name variations
            .replace(/^db\s+/i, 'dumbbell ')
            .replace(/^bb\s+/i, 'barbell ')
            .replace(/\s+press$/i, ' press')
            .replace(/\s+row$/i, ' row')
            .replace(/\s+curl$/i, ' curl')
            // Plural to singular
            .replace(/squats?$/i, 'squat')
            .replace(/deadlifts?$/i, 'deadlift')
            .replace(/lunges?$/i, 'lunge')
            .replace(/presses$/i, 'press')
            .replace(/rows$/i, 'row')
            .replace(/curls$/i, 'curl');
    };
    /**
     * Get the best fuzzy match from a list of exercises
     */
    ExerciseValidationService.getBestFuzzyMatch = function (searchTerm, exercises) {
        var bestMatch = null;
        var bestScore = 0;
        for (var _i = 0, exercises_1 = exercises; _i < exercises_1.length; _i++) {
            var exercise = exercises_1[_i];
            var score = this.calculateSimilarity(searchTerm, exercise.name);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = exercise;
            }
        }
        return bestMatch;
    };
    /**
     * Calculate similarity score between two strings
     * Uses a combination of techniques for better matching
     */
    ExerciseValidationService.calculateSimilarity = function (str1, str2) {
        var normalized1 = this.normalizeExerciseName(str1);
        var normalized2 = this.normalizeExerciseName(str2);
        // If one string contains the other, high score
        if (normalized2.includes(normalized1) || normalized1.includes(normalized2)) {
            return 0.8;
        }
        // Token-based matching
        var tokens1 = normalized1.split(' ');
        var tokens2 = normalized2.split(' ');
        var matchingTokens = 0;
        var _loop_1 = function (token1) {
            if (tokens2.some(function (token2) { return token2.includes(token1) || token1.includes(token2); })) {
                matchingTokens++;
            }
        };
        for (var _i = 0, tokens1_1 = tokens1; _i < tokens1_1.length; _i++) {
            var token1 = tokens1_1[_i];
            _loop_1(token1);
        }
        var tokenScore = matchingTokens / Math.max(tokens1.length, tokens2.length);
        // Levenshtein distance for overall similarity
        var levenshteinScore = 1 - (this.levenshteinDistance(normalized1, normalized2) / Math.max(normalized1.length, normalized2.length));
        // Combine scores
        return (tokenScore * 0.7) + (levenshteinScore * 0.3);
    };
    /**
     * Calculate Levenshtein distance between two strings
     */
    ExerciseValidationService.levenshteinDistance = function (str1, str2) {
        var matrix = [];
        // Initialize the matrix
        for (var i = 0; i <= str2.length; i++) {
            matrix[i] = [];
            matrix[i][0] = i;
        }
        for (var j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        // Fill the matrix
        for (var i = 1; i <= str2.length; i++) {
            for (var j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                }
                else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1, // insertion
                    matrix[i - 1][j] + 1 // deletion
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    };
    ExerciseValidationService.hybridMatcher = new hybridExerciseMatcherService_1.HybridExerciseMatcherService();
    return ExerciseValidationService;
}());
exports.ExerciseValidationService = ExerciseValidationService;
