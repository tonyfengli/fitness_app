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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridExerciseMatcherService = void 0;
var logger_1 = require("../utils/logger");
var exerciseMatchingLLMService_1 = require("./exerciseMatchingLLMService");
var logger = (0, logger_1.createLogger)("HybridExerciseMatcherService");
var HybridExerciseMatcherService = /** @class */ (function () {
    function HybridExerciseMatcherService() {
        this.llmService = new exerciseMatchingLLMService_1.ExerciseMatchingLLMService();
    }
    /**
     * Main entry point for matching exercise phrases to database exercises
     */
    HybridExerciseMatcherService.prototype.matchExercises = function (userPhrase, availableExercises, intent) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, typeMatch, parseTimeMs_1, patternMatch, parseTimeMs_2, llmResult, matchedExercises, parseTimeMs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        logger.info("Starting hybrid exercise matching", {
                            userPhrase: userPhrase,
                            intent: intent,
                            exerciseCount: availableExercises.length
                        });
                        typeMatch = this.matchByExerciseType(userPhrase, availableExercises);
                        if (typeMatch.matchedExercises.length > 0) {
                            parseTimeMs_1 = Date.now() - startTime;
                            logger.info("Matched by exercise type", {
                                userPhrase: userPhrase,
                                matchCount: typeMatch.matchedExercises.length,
                                parseTimeMs: parseTimeMs_1
                            });
                            return [2 /*return*/, __assign(__assign({}, typeMatch), { parseTimeMs: parseTimeMs_1 })];
                        }
                        patternMatch = this.matchByPatterns(userPhrase, availableExercises);
                        if (patternMatch.matchedExercises.length > 0) {
                            parseTimeMs_2 = Date.now() - startTime;
                            logger.info("Matched by pattern", {
                                userPhrase: userPhrase,
                                matchCount: patternMatch.matchedExercises.length,
                                parseTimeMs: parseTimeMs_2
                            });
                            return [2 /*return*/, __assign(__assign({}, patternMatch), { parseTimeMs: parseTimeMs_2 })];
                        }
                        // 3. Fall back to LLM for fuzzy matching
                        logger.info("Falling back to LLM matching", { userPhrase: userPhrase });
                        return [4 /*yield*/, this.llmService.matchUserIntent(userPhrase, availableExercises, intent)];
                    case 1:
                        llmResult = _a.sent();
                        matchedExercises = availableExercises
                            .filter(function (ex) { return llmResult.matchedExerciseNames.includes(ex.name); })
                            .map(function (ex) { return ({ id: ex.id, name: ex.name }); });
                        parseTimeMs = Date.now() - startTime;
                        return [2 /*return*/, {
                                matchedExerciseNames: llmResult.matchedExerciseNames,
                                matchedExercises: matchedExercises,
                                matchMethod: "llm",
                                reasoning: llmResult.reasoning,
                                systemPrompt: llmResult.systemPrompt,
                                model: llmResult.model,
                                llmResponse: llmResult.llmResponse,
                                parseTimeMs: llmResult.parseTimeMs || parseTimeMs
                            }];
                }
            });
        });
    };
    /**
     * Match by exercise type with basic normalization
     */
    HybridExerciseMatcherService.prototype.matchByExerciseType = function (userPhrase, exercises) {
        var normalized = userPhrase.toLowerCase().trim();
        // Remove trailing 's' for simple plural handling
        var singular = normalized.replace(/s$/, '');
        // Direct mapping to exercise_type enum values
        var typeMap = {
            // Squat variations
            'squat': 'squat',
            'squats': 'squat',
            // Lunge variations
            'lunge': 'lunge',
            'lunges': 'lunge',
            // Bench press variations
            'bench': 'bench_press',
            'bench press': 'bench_press',
            'bench presses': 'bench_press',
            // Pull-up variations
            'pull-up': 'pull_up',
            'pullup': 'pull_up',
            'pull up': 'pull_up',
            'pullups': 'pull_up',
            'pull-ups': 'pull_up',
            'pull ups': 'pull_up',
            // Deadlift variations
            'deadlift': 'deadlift',
            'deadlifts': 'deadlift',
            // Row variations
            'row': 'row',
            'rows': 'row',
            // Press variations (non-bench)
            'press': 'press',
            'presses': 'press',
            // Other exercise types
            'curl': 'curl',
            'curls': 'curl',
            'fly': 'fly',
            'flies': 'fly',
            'plank': 'plank',
            'planks': 'plank',
            'carry': 'carry',
            'carries': 'carry',
            'raise': 'raise',
            'raises': 'raise',
            'extension': 'extension',
            'extensions': 'extension',
            'push-up': 'push_up',
            'pushup': 'push_up',
            'push up': 'push_up',
            'pushups': 'push_up',
            'push-ups': 'push_up',
            'push ups': 'push_up',
            'dip': 'dip',
            'dips': 'dip',
            'shrug': 'shrug',
            'shrugs': 'shrug',
            'bridge': 'bridge',
            'bridges': 'bridge',
            'step-up': 'step_up',
            'step up': 'step_up',
            'stepup': 'step_up',
            'step-ups': 'step_up',
            'step ups': 'step_up',
            'stepups': 'step_up',
            'calf raise': 'calf_raise',
            'calf raises': 'calf_raise',
            'crunch': 'crunch',
            'crunches': 'crunch',
            'leg raise': 'leg_raise',
            'leg raises': 'leg_raise',
            'pulldown': 'pulldown',
            'pulldowns': 'pulldown',
            'pullover': 'pullover',
            'pullovers': 'pullover',
            'kickback': 'kickback',
            'kickbacks': 'kickback',
            'thruster': 'thruster',
            'thrusters': 'thruster',
            'swing': 'swing',
            'swings': 'swing',
        };
        var exerciseType = typeMap[normalized] || typeMap[singular];
        if (!exerciseType) {
            return {
                matchedExerciseNames: [],
                matchedExercises: [],
                matchMethod: "exercise_type"
            };
        }
        var matched = exercises.filter(function (ex) { return ex.exerciseType === exerciseType; });
        return {
            matchedExerciseNames: matched.map(function (ex) { return ex.name; }),
            matchedExercises: matched.map(function (ex) { return ({ id: ex.id, name: ex.name }); }),
            matchMethod: "exercise_type",
            reasoning: "Matched all exercises with type: ".concat(exerciseType)
        };
    };
    /**
     * Match by deterministic patterns
     */
    HybridExerciseMatcherService.prototype.matchByPatterns = function (userPhrase, exercises) {
        var _this = this;
        var normalized = userPhrase.toLowerCase().trim();
        // Pattern 1: Modifier + Exercise Type
        var modifierPatterns = [
            {
                pattern: /^(heavy|barbell)\s+(squats?|deadlifts?|bench\s*press)$/,
                matcher: function (ex, match) {
                    var _a;
                    var exerciseTypeMatch = _this.getExerciseTypeFromPhrase(match[2] || '');
                    return exerciseTypeMatch && ex.exerciseType === exerciseTypeMatch &&
                        ((_a = ex.equipment) === null || _a === void 0 ? void 0 : _a.includes('barbell'));
                },
                reasoning: "Matched heavy/barbell exercises"
            },
            {
                pattern: /^(light|dumbbell)\s+(squats?|press|presses|bench\s*press)$/,
                matcher: function (ex, match) {
                    var _a;
                    var exerciseTypeMatch = _this.getExerciseTypeFromPhrase(match[2] || '');
                    return exerciseTypeMatch && ex.exerciseType === exerciseTypeMatch &&
                        ((_a = ex.equipment) === null || _a === void 0 ? void 0 : _a.includes('dumbbells'));
                },
                reasoning: "Matched light/dumbbell exercises"
            },
            {
                pattern: /^bodyweight\s+(.+)$/,
                matcher: function (ex, match) {
                    var exerciseTypeMatch = _this.getExerciseTypeFromPhrase(match[1] || '');
                    return exerciseTypeMatch && ex.exerciseType === exerciseTypeMatch &&
                        (!ex.equipment || ex.equipment.length === 0);
                },
                reasoning: "Matched bodyweight exercises"
            }
        ];
        var _loop_1 = function (pattern, matcher, reasoning) {
            var match = normalized.match(pattern);
            if (match) {
                var matched = exercises.filter(function (ex) { return matcher(ex, match); });
                if (matched.length > 0) {
                    return { value: {
                            matchedExerciseNames: matched.map(function (ex) { return ex.name; }),
                            matchedExercises: matched.map(function (ex) { return ({ id: ex.id, name: ex.name }); }),
                            matchMethod: "pattern",
                            reasoning: reasoning
                        } };
                }
            }
        };
        // Check modifier patterns
        for (var _i = 0, modifierPatterns_1 = modifierPatterns; _i < modifierPatterns_1.length; _i++) {
            var _a = modifierPatterns_1[_i], pattern = _a.pattern, matcher = _a.matcher, reasoning = _a.reasoning;
            var state_1 = _loop_1(pattern, matcher, reasoning);
            if (typeof state_1 === "object")
                return state_1.value;
        }
        // Pattern 2: Equipment-only queries
        if (normalized === 'band work' || normalized === 'bands' || normalized === 'band exercises') {
            var matched = exercises.filter(function (ex) { var _a; return (_a = ex.equipment) === null || _a === void 0 ? void 0 : _a.includes('bands'); });
            return {
                matchedExerciseNames: matched.map(function (ex) { return ex.name; }),
                matchedExercises: matched.map(function (ex) { return ({ id: ex.id, name: ex.name }); }),
                matchMethod: "pattern",
                reasoning: "Matched band exercises"
            };
        }
        if (normalized === 'bodyweight' || normalized === 'bodyweight exercises') {
            var matched = exercises.filter(function (ex) { return !ex.equipment || ex.equipment.length === 0; });
            return {
                matchedExerciseNames: matched.map(function (ex) { return ex.name; }),
                matchedExercises: matched.map(function (ex) { return ({ id: ex.id, name: ex.name }); }),
                matchMethod: "pattern",
                reasoning: "Matched bodyweight exercises"
            };
        }
        if (normalized === 'dumbbells only' || normalized === 'only dumbbells' || normalized === 'dumbbell only') {
            var matched = exercises.filter(function (ex) { var _a; return ((_a = ex.equipment) === null || _a === void 0 ? void 0 : _a.length) === 1 && ex.equipment[0] === 'dumbbells'; });
            return {
                matchedExerciseNames: matched.map(function (ex) { return ex.name; }),
                matchedExercises: matched.map(function (ex) { return ({ id: ex.id, name: ex.name }); }),
                matchMethod: "pattern",
                reasoning: "Matched dumbbell-only exercises"
            };
        }
        // Pattern 3: Movement patterns
        var movementPatterns = {
            'pushing': ['horizontal_push', 'vertical_push'],
            'push exercises': ['horizontal_push', 'vertical_push'],
            'pulling': ['horizontal_pull', 'vertical_pull'],
            'pull exercises': ['horizontal_pull', 'vertical_pull'],
            'carries': ['carry'],
            'core work': ['core'],
            'core exercises': ['core']
        };
        if (movementPatterns[normalized]) {
            var matched = exercises.filter(function (ex) { var _a; return ex.movementPattern && ((_a = movementPatterns[normalized]) === null || _a === void 0 ? void 0 : _a.includes(ex.movementPattern)); });
            return {
                matchedExerciseNames: matched.map(function (ex) { return ex.name; }),
                matchedExercises: matched.map(function (ex) { return ({ id: ex.id, name: ex.name }); }),
                matchMethod: "pattern",
                reasoning: "Matched ".concat(normalized)
            };
        }
        // No pattern matched
        return {
            matchedExerciseNames: [],
            matchedExercises: [],
            matchMethod: "pattern"
        };
    };
    /**
     * Helper to get exercise type from phrase variations
     */
    HybridExerciseMatcherService.prototype.getExerciseTypeFromPhrase = function (phrase) {
        var normalized = phrase.toLowerCase().trim();
        // Handle variations
        if (normalized.includes('squat'))
            return 'squat';
        if (normalized.includes('deadlift'))
            return 'deadlift';
        if (normalized.includes('bench'))
            return 'bench_press';
        if (normalized.includes('press'))
            return 'press';
        return null;
    };
    return HybridExerciseMatcherService;
}());
exports.HybridExerciseMatcherService = HybridExerciseMatcherService;
