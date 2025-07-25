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
exports.PreferenceUpdateParser = void 0;
var logger_1 = require("../utils/logger");
var exerciseUpdateParser_1 = require("./exerciseUpdateParser");
var exerciseDisambiguationService_1 = require("./exerciseDisambiguationService");
var logger = (0, logger_1.createLogger)("PreferenceUpdateParser");
var PreferenceUpdateParser = /** @class */ (function () {
    function PreferenceUpdateParser() {
    }
    /**
     * Parse a message for preference updates
     */
    PreferenceUpdateParser.parseUpdate = function (message, currentPreferences, businessId) {
        return __awaiter(this, void 0, void 0, function () {
            var result, lowerMessage, intensityUpdate, goalUpdate, isReplacement, isSessionGoalOnly, exerciseUpdateIntent, _a, validation, currentIncludes_1, newExercises, validation, currentIncludes, exercisesToRemove_1, filteredIncludes, removedFromIncludes, currentAvoids_1, newAvoids, muscleUpdates, jointUpdates;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        result = {
                            hasUpdates: false,
                            updates: {},
                            updateType: null,
                            fieldsUpdated: [],
                            rawInput: message
                        };
                        lowerMessage = message.toLowerCase();
                        intensityUpdate = this.parseIntensityUpdate(lowerMessage);
                        if (intensityUpdate) {
                            result.updates.intensity = intensityUpdate;
                            result.fieldsUpdated.push('intensity');
                            result.hasUpdates = true;
                        }
                        goalUpdate = this.parseSessionGoalUpdate(lowerMessage);
                        if (goalUpdate !== undefined) {
                            result.updates.sessionGoal = goalUpdate;
                            result.fieldsUpdated.push('sessionGoal');
                            result.hasUpdates = true;
                        }
                        isReplacement = /\binstead\b/i.test(message);
                        isSessionGoalOnly = goalUpdate !== undefined &&
                            /\b(make\s+(this|it)\s+a?\s+(strength|stability|endurance)\s+session|focus\s+on\s+(strength|stability|endurance))\b/i.test(lowerMessage);
                        if (!isSessionGoalOnly) return [3 /*break*/, 1];
                        _a = { action: 'unknown', exercises: [], rawInput: message };
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, exerciseUpdateParser_1.exerciseUpdateParser.parseExerciseUpdate(message, businessId)];
                    case 2:
                        _a = _b.sent();
                        _b.label = 3;
                    case 3:
                        exerciseUpdateIntent = _a;
                        if (exerciseUpdateIntent.action !== 'unknown' && exerciseUpdateIntent.exercises.length > 0) {
                            // Use the validation result from the exercise update parser if available
                            if (exerciseUpdateIntent.action === 'add' || isReplacement) {
                                validation = exerciseUpdateIntent.validationResult || {
                                    validatedExercises: exerciseUpdateIntent.exercises,
                                    matches: [],
                                    hasUnrecognized: false
                                };
                                // Check if disambiguation is needed
                                if (exerciseDisambiguationService_1.ExerciseDisambiguationService.checkNeedsDisambiguation(validation)) {
                                    result.exerciseValidation = {
                                        includeValidation: validation,
                                        needsDisambiguation: true
                                    };
                                    result.hasUpdates = true;
                                    result.updateType = isReplacement ? 'change' : 'add';
                                    return [2 /*return*/, result]; // Return early - disambiguation needed
                                }
                                // No disambiguation needed - proceed with validated exercises
                                if (isReplacement) {
                                    result.updates.includeExercises = validation.validatedExercises;
                                    result.fieldsUpdated.push('includeExercises');
                                    result.hasUpdates = true;
                                    result.updateType = 'change';
                                }
                                else {
                                    currentIncludes_1 = currentPreferences.includeExercises || [];
                                    newExercises = validation.validatedExercises.filter(function (exercise) { return !currentIncludes_1.some(function (included) { return included.toLowerCase() === exercise.toLowerCase(); }); });
                                    if (newExercises.length > 0) {
                                        result.updates.includeExercises = __spreadArray(__spreadArray([], currentIncludes_1, true), newExercises, true);
                                        result.fieldsUpdated.push('includeExercises');
                                        result.hasUpdates = true;
                                    }
                                }
                            }
                            else if (exerciseUpdateIntent.action === 'remove') {
                                validation = exerciseUpdateIntent.validationResult || {
                                    validatedExercises: exerciseUpdateIntent.exercises,
                                    matches: [],
                                    hasUnrecognized: false
                                };
                                // Check if disambiguation is needed
                                if (exerciseDisambiguationService_1.ExerciseDisambiguationService.checkNeedsDisambiguation(validation)) {
                                    result.exerciseValidation = {
                                        avoidValidation: validation,
                                        needsDisambiguation: true
                                    };
                                    result.hasUpdates = true;
                                    result.updateType = 'remove';
                                    return [2 /*return*/, result]; // Return early - disambiguation needed
                                }
                                currentIncludes = currentPreferences.includeExercises || [];
                                exercisesToRemove_1 = validation.validatedExercises;
                                filteredIncludes = currentIncludes.filter(function (exercise) { return !exercisesToRemove_1.some(function (toRemove) { return exercise.toLowerCase() === toRemove.toLowerCase(); }); });
                                removedFromIncludes = currentIncludes.length > filteredIncludes.length;
                                if (removedFromIncludes) {
                                    // Some exercises were removed from includes
                                    result.updates.includeExercises = filteredIncludes;
                                    result.fieldsUpdated.push('includeExercises');
                                    result.hasUpdates = true;
                                }
                                currentAvoids_1 = currentPreferences.avoidExercises || [];
                                newAvoids = exercisesToRemove_1.filter(function (exercise) { return !currentAvoids_1.some(function (avoided) { return avoided.toLowerCase() === exercise.toLowerCase(); }); });
                                if (newAvoids.length > 0) {
                                    result.updates.avoidExercises = __spreadArray(__spreadArray([], currentAvoids_1, true), newAvoids, true);
                                    result.fieldsUpdated.push('avoidExercises');
                                    result.hasUpdates = true;
                                }
                            }
                        }
                        muscleUpdates = this.parseMuscleUpdates(lowerMessage, currentPreferences);
                        if (muscleUpdates.hasChanges) {
                            if (muscleUpdates.targetsToAdd.length > 0) {
                                result.updates.muscleTargets = __spreadArray(__spreadArray([], (currentPreferences.muscleTargets || []), true), muscleUpdates.targetsToAdd, true);
                                result.fieldsUpdated.push('muscleTargets');
                            }
                            if (muscleUpdates.toAvoid.length > 0) {
                                result.updates.muscleLessens = __spreadArray(__spreadArray([], (currentPreferences.muscleLessens || []), true), muscleUpdates.toAvoid, true);
                                result.fieldsUpdated.push('muscleLessens');
                            }
                            result.hasUpdates = true;
                        }
                        jointUpdates = this.parseJointUpdates(lowerMessage, currentPreferences);
                        if (jointUpdates.length > 0) {
                            result.updates.avoidJoints = jointUpdates;
                            result.fieldsUpdated.push('avoidJoints');
                            result.hasUpdates = true;
                        }
                        // Determine update type
                        if (result.hasUpdates) {
                            result.updateType = this.determineUpdateType(lowerMessage);
                        }
                        logger.info("Parsed preference update", {
                            hasUpdates: result.hasUpdates,
                            fieldsUpdated: result.fieldsUpdated,
                            updateType: result.updateType
                        });
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Parse intensity updates
     */
    PreferenceUpdateParser.parseIntensityUpdate = function (message) {
        var patterns = [
            { pattern: /\b(easy|easier|light|lighter|low|gentle|relax|tired)\b/i, value: 'low' },
            { pattern: /\b(moderate|medium|normal|regular)\b/i, value: 'moderate' },
            { pattern: /\b(hard|harder|heavy|intense|high|crush|destroy|kick\s+(my\s+)?(butt|ass)|push\s+me|challenge\s+me|bring\s+it|all\s+out)\b/i, value: 'high' },
        ];
        // Look for explicit intensity change patterns
        if (this.UPDATE_PATTERNS.intensityChange.test(message)) {
            for (var _i = 0, patterns_1 = patterns; _i < patterns_1.length; _i++) {
                var _a = patterns_1[_i], pattern = _a.pattern, value = _a.value;
                if (pattern.test(message)) {
                    return value;
                }
            }
        }
        // Also check for simple intensity mentions with update context
        var hasUpdateContext = /\b(actually|instead|change|make|go|feel|feeling|want|push|challenge|bring|destroy|crush|let's|need|take)\b/i.test(message);
        if (hasUpdateContext) {
            for (var _b = 0, patterns_2 = patterns; _b < patterns_2.length; _b++) {
                var _c = patterns_2[_b], pattern = _c.pattern, value = _c.value;
                if (pattern.test(message)) {
                    return value;
                }
            }
        }
        return null;
    };
    /**
     * Parse session goal updates
     */
    PreferenceUpdateParser.parseSessionGoalUpdate = function (message) {
        if (/\b(strength|strong|heavy)\b/i.test(message) && this.hasUpdateIntent(message)) {
            return 'strength';
        }
        if (/\b(stability|balance|control)\b/i.test(message) && this.hasUpdateIntent(message)) {
            return 'stability';
        }
        return undefined;
    };
    /**
     * Parse muscle updates
     */
    PreferenceUpdateParser.parseMuscleUpdates = function (message, current) {
        var result = { hasChanges: false, targetsToAdd: [], toAvoid: [] };
        var musclePatterns = [
            'chest', 'back', 'shoulders', 'arms', 'legs', 'glutes',
            'core', 'abs', 'triceps', 'biceps', 'quads', 'hamstrings',
            'calves', 'delts', 'lats', 'traps'
        ];
        var muscleRegex = new RegExp("\\b(".concat(musclePatterns.join('|'), ")\\b"), 'gi');
        var matches = message.match(muscleRegex) || [];
        if (matches.length > 0) {
            // Check context
            var isAvoid = /\b(sore|tired|rest|avoid|skip|no)\b/i.test(message);
            var isTarget = /\b(work|hit|focus|target|add)\b/i.test(message);
            if (isAvoid) {
                result.toAvoid = matches.map(function (m) { return m.toLowerCase(); });
                result.hasChanges = true;
            }
            else if (isTarget) {
                result.targetsToAdd = matches.map(function (m) { return m.toLowerCase(); });
                result.hasChanges = true;
            }
        }
        return result;
    };
    /**
     * Parse joint updates
     */
    PreferenceUpdateParser.parseJointUpdates = function (message, current) {
        var jointPatterns = ['knees?', 'shoulders?', 'wrists?', 'elbows?', 'ankles?', 'hips?', 'back', 'neck'];
        var jointRegex = new RegExp("\\b(".concat(jointPatterns.join('|'), ")\\b"), 'gi');
        var matches = message.match(jointRegex) || [];
        var hasJointIssue = /\b(hurt|hurting|pain|sore|protect|careful|issue|problem|ache|aching)\b/i.test(message);
        if (matches.length > 0 && hasJointIssue) {
            return matches.map(function (m) { return m.toLowerCase().replace(/s$/, ''); }); // Remove plural 's'
        }
        return [];
    };
    /**
     * Check if message has update intent
     */
    PreferenceUpdateParser.hasUpdateIntent = function (message) {
        var updateWords = /\b(actually|instead|change|update|switch|add|remove|also|plus|now|today|feeling|want|let's|make)\b/i;
        return updateWords.test(message);
    };
    /**
     * Determine the type of update
     */
    PreferenceUpdateParser.determineUpdateType = function (message) {
        var hasAdd = this.UPDATE_PATTERNS.add.test(message);
        var hasRemove = this.UPDATE_PATTERNS.remove.test(message);
        var hasChange = this.UPDATE_PATTERNS.change.test(message);
        // Check for intensity-specific phrases that indicate change
        var hasIntensityChange = /\b(kick|push|challenge|destroy|crush|easy|light|hard)\b/i.test(message);
        if ((hasAdd || hasIntensityChange) && hasRemove)
            return 'mixed';
        if (hasAdd && hasIntensityChange)
            return 'mixed';
        if (hasChange || hasIntensityChange)
            return 'change';
        if (hasAdd)
            return 'add';
        if (hasRemove)
            return 'remove';
        return 'change'; // Default to change if intent is unclear
    };
    /**
     * Generate a confirmation message for updates
     */
    PreferenceUpdateParser.generateUpdateConfirmation = function (updateResult, targetedFollowupService) {
        if (!updateResult.hasUpdates) {
            return "I didn't catch any changes you'd like to make. Could you rephrase what you'd like to update?";
        }
        var fieldsUpdated = updateResult.fieldsUpdated, updates = updateResult.updates;
        // Use the TargetedFollowupService method for consistent messaging
        return targetedFollowupService.generateUpdateResponse(fieldsUpdated);
    };
    /**
     * Patterns for detecting update intent
     */
    PreferenceUpdateParser.UPDATE_PATTERNS = {
        // Addition patterns
        add: /\b(add|include|also|plus|and|with)\b/i,
        // Removal patterns  
        remove: /\b(remove|skip|no|avoid|without|stop|don't|dont|exclude)\b/i,
        // Change patterns
        change: /\b(change|switch|instead|replace|make it|update)\b/i,
        // Intensity changes
        intensityChange: /\b(go|make it|switch to|change to)\s+(easy|easier|light|lighter|hard|harder|moderate|medium)\b/i,
        // Session goal changes
        goalChange: /\b(focus on|switch to|change to|do)\s+(strength|stability|endurance)\b/i,
    };
    return PreferenceUpdateParser;
}());
exports.PreferenceUpdateParser = PreferenceUpdateParser;
