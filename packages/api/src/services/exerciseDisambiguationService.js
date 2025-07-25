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
exports.ExerciseDisambiguationService = void 0;
var exerciseValidationService_1 = require("./exerciseValidationService");
var conversationStateService_1 = require("./conversationStateService");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.createLogger)('ExerciseDisambiguationService');
var ExerciseDisambiguationService = /** @class */ (function () {
    function ExerciseDisambiguationService() {
    }
    /**
     * Process exercise requests and check if disambiguation is needed
     */
    ExerciseDisambiguationService.processExercises = function (exerciseRequest, context) {
        return __awaiter(this, void 0, void 0, function () {
            var exercises, intent, validationIntent, validation, ambiguousMatches, allOptions, message, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        exercises = exerciseRequest.exercises, intent = exerciseRequest.intent;
                        if (!exercises || exercises.length === 0) {
                            return [2 /*return*/, {
                                    needsDisambiguation: false,
                                    validatedExercises: []
                                }];
                        }
                        validationIntent = intent === 'replace' ? 'include' : intent;
                        return [4 /*yield*/, exerciseValidationService_1.ExerciseValidationService.validateExercises(exercises, context.businessId, validationIntent, context.sessionId)];
                    case 1:
                        validation = _a.sent();
                        ambiguousMatches = validation.matches.filter(function (match) { return match.matchedExercises.length > 1; });
                        if (ambiguousMatches.length > 0) {
                            allOptions = this.collectAllOptions(ambiguousMatches);
                            message = this.formatMessage(ambiguousMatches, context);
                            return [2 /*return*/, {
                                    needsDisambiguation: true,
                                    disambiguationMessage: message,
                                    ambiguousMatches: ambiguousMatches,
                                    allOptions: allOptions
                                }];
                        }
                        // No disambiguation needed
                        return [2 /*return*/, {
                                needsDisambiguation: false,
                                validatedExercises: validation.validatedExercises
                            }];
                    case 2:
                        error_1 = _a.sent();
                        logger.error('Error processing exercises for disambiguation', error_1);
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Format disambiguation message based on context
     */
    ExerciseDisambiguationService.formatMessage = function (ambiguousMatches, context) {
        var message = '';
        // Context-specific intro
        switch (context.type) {
            case 'preference_initial':
                message = 'I found multiple exercises matching your request. Please select by number:\n\n';
                break;
            case 'preference_update':
                message = 'I found multiple exercises matching your request. Please select by number:\n\n';
                break;
            case 'workout_edit':
                message = 'I found multiple replacement options. Please select by number:\n\n';
                break;
        }
        // Build options list
        var optionNumber = 1;
        for (var _i = 0, ambiguousMatches_1 = ambiguousMatches; _i < ambiguousMatches_1.length; _i++) {
            var match = ambiguousMatches_1[_i];
            message += "For \"".concat(match.userInput, "\":\n");
            for (var _a = 0, _b = match.matchedExercises; _a < _b.length; _a++) {
                var exercise = _b[_a];
                message += "".concat(optionNumber, ". ").concat(exercise.name, "\n");
                optionNumber++;
            }
            message += '\n';
        }
        message += "Reply with number(s) (e.g., '1' or '1,3')";
        return message;
    };
    /**
     * Save disambiguation state based on context
     */
    ExerciseDisambiguationService.saveDisambiguationState = function (state, context) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 5, , 6]);
                        _a = context.type;
                        switch (_a) {
                            case 'preference_initial': return [3 /*break*/, 1];
                            case 'preference_update': return [3 /*break*/, 1];
                            case 'workout_edit': return [3 /*break*/, 3];
                        }
                        return [3 /*break*/, 4];
                    case 1: 
                    // Save to conversation state for preferences
                    return [4 /*yield*/, conversationStateService_1.ConversationStateService.createExerciseDisambiguation(context.userId, context.sessionId, context.businessId, state.ambiguousMatches.map(function (m) { return m.userInput; }).join(", "), state.allOptions)];
                    case 2:
                        // Save to conversation state for preferences
                        _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        // TODO: Implement workout-specific state storage
                        logger.info('Workout edit disambiguation state would be saved here', {
                            workoutId: context.workoutId,
                            state: state
                        });
                        return [3 /*break*/, 4];
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        error_2 = _b.sent();
                        logger.error('Error saving disambiguation state', error_2);
                        throw error_2;
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Collect all exercise options from ambiguous matches
     */
    ExerciseDisambiguationService.collectAllOptions = function (ambiguousMatches) {
        var allOptions = [];
        for (var _i = 0, ambiguousMatches_2 = ambiguousMatches; _i < ambiguousMatches_2.length; _i++) {
            var match = ambiguousMatches_2[_i];
            for (var _a = 0, _b = match.matchedExercises; _a < _b.length; _a++) {
                var exercise = _b[_a];
                allOptions.push({
                    id: exercise.id,
                    name: exercise.name
                });
            }
        }
        return allOptions;
    };
    /**
     * Check if a validation result needs disambiguation
     */
    ExerciseDisambiguationService.checkNeedsDisambiguation = function (validationResult) {
        return validationResult.matches.some(function (match) { return match.matchedExercises.length > 1; });
    };
    return ExerciseDisambiguationService;
}());
exports.ExerciseDisambiguationService = ExerciseDisambiguationService;
