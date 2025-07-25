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
exports.exerciseUpdateParser = exports.ExerciseUpdateParser = void 0;
var exerciseValidationService_1 = require("./exerciseValidationService");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.createLogger)('ExerciseUpdateParser');
var ExerciseUpdateParser = /** @class */ (function () {
    function ExerciseUpdateParser() {
    }
    /**
     * Parse exercise update from message
     * Uses ExerciseValidationService for intelligent exercise matching
     */
    ExerciseUpdateParser.prototype.parseExerciseUpdate = function (message, businessId) {
        return __awaiter(this, void 0, void 0, function () {
            var intent, exerciseMentions, validatedExercises, allMatches, validation, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        intent = this.determineIntent(message);
                        if (intent === 'unknown') {
                            return [2 /*return*/, {
                                    action: 'unknown',
                                    exercises: [],
                                    rawInput: message
                                }];
                        }
                        exerciseMentions = this.extractPotentialExercises(message);
                        if (exerciseMentions.length === 0) {
                            // Even with intent, no exercises found
                            return [2 /*return*/, {
                                    action: intent,
                                    exercises: [],
                                    rawInput: message
                                }];
                        }
                        validatedExercises = [];
                        allMatches = [];
                        logger.debug('Validating exercise mentions', { mentions: exerciseMentions, intent: intent });
                        return [4 /*yield*/, exerciseValidationService_1.ExerciseValidationService.validateExercises(exerciseMentions, businessId || 'default', intent === 'add' ? 'include' : 'avoid')];
                    case 1:
                        validation = _a.sent();
                        return [2 /*return*/, {
                                action: intent,
                                exercises: __spreadArray([], new Set(validation.validatedExercises), true), // Remove duplicates
                                rawInput: message,
                                validationResult: validation // Include the full validation result
                            }];
                    case 2:
                        error_1 = _a.sent();
                        logger.error('Failed to parse exercise update', error_1);
                        return [2 /*return*/, {
                                action: 'unknown',
                                exercises: [],
                                rawInput: message
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Determine the intent of the update (add or remove)
     */
    ExerciseUpdateParser.prototype.determineIntent = function (message) {
        // Check for special context patterns first
        if (ExerciseUpdateParser.CONTEXT_PATTERNS.negativeWant.test(message)) {
            return 'remove';
        }
        var hasRemoveIntent = ExerciseUpdateParser.INTENT_PATTERNS.remove.test(message);
        var hasAddIntent = ExerciseUpdateParser.INTENT_PATTERNS.add.test(message);
        // If both intents present, prioritize remove (safer)
        if (hasRemoveIntent && hasAddIntent) {
            // Look for stronger signals
            var removeStrength = this.getIntentStrength(message, 'remove');
            var addStrength = this.getIntentStrength(message, 'add');
            return removeStrength > addStrength ? 'remove' : 'add';
        }
        if (hasRemoveIntent)
            return 'remove';
        if (hasAddIntent)
            return 'add';
        // Check for "want" after checking negative patterns
        if (/\bwant\b/i.test(message) && !hasRemoveIntent) {
            return 'add';
        }
        // Check for common exercise request patterns
        if (/^let'?s\s+(do\s+)?/i.test(message)) {
            return 'add';
        }
        // Check for update context - but don't assume it's always addition
        var hasUpdateContext = /\b(actually|instead|change|update)\b/i.test(message);
        if (hasUpdateContext && !hasRemoveIntent && !hasAddIntent) {
            // Only default to 'add' if there's update context but no clear intent
            return 'unknown';
        }
        return 'unknown';
    };
    /**
     * Get the strength of an intent based on keyword proximity
     */
    ExerciseUpdateParser.prototype.getIntentStrength = function (message, intent) {
        var pattern = ExerciseUpdateParser.INTENT_PATTERNS[intent];
        var matches = message.match(pattern);
        if (!matches)
            return 0;
        // Strong intent keywords
        var strongKeywords = {
            add: ['add', 'include', 'want'],
            remove: ['remove', 'delete', 'don\'t', 'dont']
        };
        var keyword = matches[0].toLowerCase();
        return strongKeywords[intent].includes(keyword) ? 2 : 1;
    };
    /**
     * Extract potential exercise mentions from message
     */
    ExerciseUpdateParser.prototype.extractPotentialExercises = function (message) {
        var _a;
        var mentions = [];
        // First, try to find exercise mentions after common patterns
        var afterPatterns = [
            /(?:add|include|skip|remove|avoid|do|try)\s+(?:some\s+)?(.+?)(?:\s*(?:to|from|for|please|today|now|thanks|$))/gi,
            /(?:let'?s\s+do|want\s+to\s+do)\s+(.+?)(?:\s*(?:today|now|please|thanks|$))/gi,
            /(?:don'?t|dont)\s+want\s+(?:to\s+do\s+)?(.+?)(?:\s*(?:anymore|today|now|please|thanks|$))/gi,
        ];
        for (var _i = 0, afterPatterns_1 = afterPatterns; _i < afterPatterns_1.length; _i++) {
            var pattern = afterPatterns_1[_i];
            var match = void 0;
            while ((match = pattern.exec(message)) !== null) {
                var exercisePart = (_a = match[1]) === null || _a === void 0 ? void 0 : _a.trim();
                if (exercisePart && !mentions.includes(exercisePart)) {
                    mentions.push(exercisePart);
                }
            }
        }
        // If no matches from patterns, fall back to segment-based extraction
        if (mentions.length === 0) {
            // Split message into segments
            var segments = message.split(/[,;.!?]|\b(?:and|or|also|plus)\b/i);
            var _loop_1 = function (segment) {
                // Clean up segment
                var cleaned = segment.trim().toLowerCase();
                if (!cleaned)
                    return "continue";
                // Remove intent words to isolate exercise names
                var exercisePart = cleaned;
                // Remove intent keywords but preserve the exercise name
                exercisePart = exercisePart
                    .replace(/^(actually\s+)?/i, '')
                    .replace(/^(i\s+)?(don'?t|dont|do\s+not)\s+want\s+(to\s+)?(do\s+)?/i, '')
                    .replace(/^(i\s+)?(want\s+to\s+|wanna\s+|let'?s\s+do\s+|let'?s\s+)/i, '')
                    .replace(/^(add|include|skip|remove|avoid|without|stop|exclude|delete)\s+/i, '')
                    .replace(/^(some|the|that|those|these|any)\s+/i, '')
                    .replace(/\s+(anymore|instead|rather|today|now|please|thanks)$/i, '')
                    .replace(/,?\s+(remove|delete|skip)\s+that$/i, '')
                    .trim();
                if (exercisePart && exercisePart.length > 2) {
                    // Don't add duplicates
                    if (!mentions.some(function (m) { return m.toLowerCase() === exercisePart.toLowerCase(); })) {
                        mentions.push(exercisePart);
                        logger.debug('Extracted exercise mention', { original: segment, cleaned: exercisePart });
                    }
                }
            };
            for (var _b = 0, segments_1 = segments; _b < segments_1.length; _b++) {
                var segment = segments_1[_b];
                _loop_1(segment);
            }
        }
        return mentions;
    };
    // Pattern matching for update intent
    ExerciseUpdateParser.INTENT_PATTERNS = {
        add: /\b(add|include|also|plus|and|with|let's do|lets do|want to do|wanna do|try|focus on)\b/i,
        remove: /\b(remove|skip|no|avoid|without|stop|don't|dont|exclude|delete)\b/i,
        replace: /\b(instead|replace|switch to|change to)\b/i,
    };
    // Special patterns that need context
    ExerciseUpdateParser.CONTEXT_PATTERNS = {
        negativeWant: /\b(don't|dont|do not)\s+want/i,
        actuallyPattern: /\b(actually|wait|no)\b.*\b(instead|rather|change)\b/i,
    };
    return ExerciseUpdateParser;
}());
exports.ExerciseUpdateParser = ExerciseUpdateParser;
// Export singleton instance
exports.exerciseUpdateParser = new ExerciseUpdateParser();
