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
exports.WorkoutPreferenceService = void 0;
exports.setPreferenceBroadcastFunction = setPreferenceBroadcastFunction;
var client_1 = require("@acme/db/client");
var schema_1 = require("@acme/db/schema");
var db_1 = require("@acme/db");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.createLogger)("WorkoutPreferenceService");
// Type for the broadcast function - will be injected from the API layer
var broadcastPreferenceUpdate = null;
function setPreferenceBroadcastFunction(fn) {
    broadcastPreferenceUpdate = fn;
}
var WorkoutPreferenceService = /** @class */ (function () {
    function WorkoutPreferenceService() {
    }
    WorkoutPreferenceService.getPreferencePrompt = function (userName) {
        var name = userName || "there";
        return "You're checked in, ".concat(name, "! What's your priority for today's session? Examples: \"abs\" or \"stability work.\"");
    };
    WorkoutPreferenceService.isAwaitingPreferences = function (phoneNumber) {
        return __awaiter(this, void 0, void 0, function () {
            var foundUser, activeCheckIn, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, client_1.db
                                .select()
                                .from(schema_1.user)
                                .where((0, db_1.eq)(schema_1.user.phone, phoneNumber))
                                .limit(1)];
                    case 1:
                        foundUser = (_a.sent())[0];
                        if (!foundUser) {
                            return [2 /*return*/, { waiting: false }];
                        }
                        return [4 /*yield*/, client_1.db
                                .select({
                                trainingSessionId: schema_1.UserTrainingSession.trainingSessionId,
                                userId: schema_1.UserTrainingSession.userId,
                                preferenceCollectionStep: schema_1.UserTrainingSession.preferenceCollectionStep,
                                businessId: schema_1.TrainingSession.businessId,
                            })
                                .from(schema_1.UserTrainingSession)
                                .innerJoin(schema_1.TrainingSession, (0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, schema_1.TrainingSession.id))
                                .where((0, db_1.and)((0, db_1.eq)(schema_1.UserTrainingSession.userId, foundUser.id), (0, db_1.eq)(schema_1.UserTrainingSession.status, "checked_in"), (0, db_1.or)((0, db_1.eq)(schema_1.UserTrainingSession.preferenceCollectionStep, "not_started"), (0, db_1.eq)(schema_1.UserTrainingSession.preferenceCollectionStep, "initial_collected"), (0, db_1.eq)(schema_1.UserTrainingSession.preferenceCollectionStep, "disambiguation_pending"), (0, db_1.eq)(schema_1.UserTrainingSession.preferenceCollectionStep, "disambiguation_clarifying"), (0, db_1.eq)(schema_1.UserTrainingSession.preferenceCollectionStep, "followup_sent"), (0, db_1.eq)(schema_1.UserTrainingSession.preferenceCollectionStep, "preferences_active")), (0, db_1.eq)(schema_1.TrainingSession.status, "open")))
                                .limit(1)];
                    case 2:
                        activeCheckIn = (_a.sent())[0];
                        if (activeCheckIn) {
                            return [2 /*return*/, {
                                    waiting: true,
                                    userId: activeCheckIn.userId,
                                    trainingSessionId: activeCheckIn.trainingSessionId,
                                    businessId: activeCheckIn.businessId,
                                    currentStep: activeCheckIn.preferenceCollectionStep,
                                }];
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        logger.error("Error checking preference state:", error_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, { waiting: false }];
                }
            });
        });
    };
    WorkoutPreferenceService.saveSimplePreferences = function (userId, sessionId, businessId, preferences) {
        return __awaiter(this, void 0, void 0, function () {
            var hasSimplePrefs, existing, error_2;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 6, , 7]);
                        hasSimplePrefs = preferences.intensity ||
                            preferences.sessionGoal !== undefined ||
                            ((_a = preferences.muscleTargets) === null || _a === void 0 ? void 0 : _a.length) ||
                            ((_b = preferences.muscleLessens) === null || _b === void 0 ? void 0 : _b.length) ||
                            ((_c = preferences.avoidJoints) === null || _c === void 0 ? void 0 : _c.length);
                        if (!hasSimplePrefs) {
                            return [2 /*return*/];
                        }
                        logger.info("Saving simple preferences (fire-and-forget)", {
                            userId: userId,
                            sessionId: sessionId,
                            hasIntensity: !!preferences.intensity,
                            hasSessionGoal: preferences.sessionGoal !== undefined,
                            hasMuscleTargets: !!((_d = preferences.muscleTargets) === null || _d === void 0 ? void 0 : _d.length)
                        });
                        return [4 /*yield*/, client_1.db
                                .select()
                                .from(schema_1.WorkoutPreferences)
                                .where((0, db_1.and)((0, db_1.eq)(schema_1.WorkoutPreferences.userId, userId), (0, db_1.eq)(schema_1.WorkoutPreferences.trainingSessionId, sessionId)))
                                .limit(1)];
                    case 1:
                        existing = (_e.sent())[0];
                        if (!existing) return [3 /*break*/, 3];
                        // Update only the simple preference fields
                        return [4 /*yield*/, client_1.db
                                .update(schema_1.WorkoutPreferences)
                                .set({
                                intensity: preferences.intensity || existing.intensity,
                                muscleTargets: preferences.muscleTargets || existing.muscleTargets,
                                muscleLessens: preferences.muscleLessens || existing.muscleLessens,
                                avoidJoints: preferences.avoidJoints || existing.avoidJoints,
                                sessionGoal: preferences.sessionGoal !== undefined ? preferences.sessionGoal : existing.sessionGoal,
                            })
                                .where((0, db_1.eq)(schema_1.WorkoutPreferences.id, existing.id))];
                    case 2:
                        // Update only the simple preference fields
                        _e.sent();
                        return [3 /*break*/, 5];
                    case 3: 
                    // Insert new preferences with only simple fields
                    return [4 /*yield*/, client_1.db.insert(schema_1.WorkoutPreferences).values({
                            userId: userId,
                            trainingSessionId: sessionId,
                            businessId: businessId,
                            intensity: preferences.intensity,
                            muscleTargets: preferences.muscleTargets,
                            muscleLessens: preferences.muscleLessens,
                            avoidJoints: preferences.avoidJoints,
                            sessionGoal: preferences.sessionGoal,
                            collectionMethod: "sms",
                        })];
                    case 4:
                        // Insert new preferences with only simple fields
                        _e.sent();
                        _e.label = 5;
                    case 5:
                        // Broadcast update if available
                        if (broadcastPreferenceUpdate) {
                            broadcastPreferenceUpdate(sessionId, {
                                userId: userId,
                                preferences: {
                                    intensity: preferences.intensity || null,
                                    muscleTargets: preferences.muscleTargets || [],
                                    muscleLessens: preferences.muscleLessens || [],
                                    avoidJoints: preferences.avoidJoints || [],
                                    sessionGoal: preferences.sessionGoal || null,
                                }
                            });
                        }
                        return [3 /*break*/, 7];
                    case 6:
                        error_2 = _e.sent();
                        logger.error("Error saving simple preferences (non-blocking):", error_2);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    WorkoutPreferenceService.savePreferences = function (userId_1, sessionId_1, businessId_1, preferences_1) {
        return __awaiter(this, arguments, void 0, function (userId, sessionId, businessId, preferences, step) {
            var existing, mergedPreferences, valuesToInsert, savedPrefs, error_3;
            var _a, _b, _c, _d, _e, _f, _g;
            if (step === void 0) { step = "initial_collected"; }
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        _h.trys.push([0, 9, , 10]);
                        return [4 /*yield*/, client_1.db
                                .select()
                                .from(schema_1.WorkoutPreferences)
                                .where((0, db_1.and)((0, db_1.eq)(schema_1.WorkoutPreferences.userId, userId), (0, db_1.eq)(schema_1.WorkoutPreferences.trainingSessionId, sessionId)))
                                .limit(1)];
                    case 1:
                        existing = (_h.sent())[0];
                        if (!existing) return [3 /*break*/, 3];
                        mergedPreferences = {
                            intensity: preferences.intensity !== undefined ? preferences.intensity : existing.intensity,
                            intensitySource: preferences.intensity !== undefined
                                ? (preferences.intensitySource || 'explicit')
                                : existing.intensitySource,
                            muscleTargets: preferences.muscleTargets !== undefined
                                ? preferences.muscleTargets
                                : existing.muscleTargets,
                            muscleLessens: preferences.muscleLessens !== undefined
                                ? preferences.muscleLessens
                                : existing.muscleLessens,
                            includeExercises: preferences.includeExercises !== undefined
                                ? preferences.includeExercises
                                : existing.includeExercises,
                            avoidExercises: preferences.avoidExercises !== undefined
                                ? preferences.avoidExercises
                                : existing.avoidExercises,
                            avoidJoints: preferences.avoidJoints !== undefined
                                ? preferences.avoidJoints
                                : existing.avoidJoints,
                            sessionGoal: preferences.sessionGoal !== undefined
                                ? preferences.sessionGoal
                                : existing.sessionGoal,
                            sessionGoalSource: preferences.sessionGoal !== undefined
                                ? (preferences.sessionGoalSource || 'explicit')
                                : existing.sessionGoalSource,
                        };
                        return [4 /*yield*/, client_1.db
                                .update(schema_1.WorkoutPreferences)
                                .set(mergedPreferences)
                                .where((0, db_1.eq)(schema_1.WorkoutPreferences.id, existing.id))];
                    case 2:
                        _h.sent();
                        logger.info("Updated existing preferences with merge", {
                            userId: userId,
                            sessionId: sessionId,
                            existing: {
                                intensity: existing.intensity,
                                includeExercisesCount: ((_a = existing.includeExercises) === null || _a === void 0 ? void 0 : _a.length) || 0,
                            },
                            new: {
                                intensity: preferences.intensity,
                                includeExercisesCount: ((_b = preferences.includeExercises) === null || _b === void 0 ? void 0 : _b.length) || 0,
                            },
                            merged: {
                                intensity: mergedPreferences.intensity,
                                includeExercisesCount: ((_c = mergedPreferences.includeExercises) === null || _c === void 0 ? void 0 : _c.length) || 0,
                            }
                        });
                        return [3 /*break*/, 5];
                    case 3:
                        valuesToInsert = {
                            userId: userId,
                            trainingSessionId: sessionId,
                            businessId: businessId,
                            intensity: preferences.intensity || 'moderate', // Default to moderate if not provided
                            intensitySource: preferences.intensity !== undefined
                                ? (preferences.intensitySource || 'explicit')
                                : 'default',
                            muscleTargets: preferences.muscleTargets,
                            muscleLessens: preferences.muscleLessens,
                            includeExercises: preferences.includeExercises,
                            avoidExercises: preferences.avoidExercises,
                            avoidJoints: preferences.avoidJoints,
                            sessionGoal: preferences.sessionGoal,
                            sessionGoalSource: preferences.sessionGoal !== undefined
                                ? (preferences.sessionGoalSource || 'explicit')
                                : 'default',
                            collectionMethod: "sms",
                        };
                        logger.info("Inserting new preferences", {
                            userId: userId,
                            sessionId: sessionId,
                            exerciseCounts: {
                                avoidExercises: ((_d = preferences.avoidExercises) === null || _d === void 0 ? void 0 : _d.length) || 0,
                                includeExercises: ((_e = preferences.includeExercises) === null || _e === void 0 ? void 0 : _e.length) || 0,
                            },
                            fullValues: valuesToInsert
                        });
                        return [4 /*yield*/, client_1.db.insert(schema_1.WorkoutPreferences).values(valuesToInsert)];
                    case 4:
                        _h.sent();
                        _h.label = 5;
                    case 5: 
                    // Update check-in to mark preferences collection step
                    return [4 /*yield*/, client_1.db
                            .update(schema_1.UserTrainingSession)
                            .set({ preferenceCollectionStep: step })
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.UserTrainingSession.userId, userId), (0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, sessionId)))];
                    case 6:
                        // Update check-in to mark preferences collection step
                        _h.sent();
                        logger.info("Preferences saved successfully", { userId: userId, sessionId: sessionId, step: step, isUpdate: !!existing });
                        if (!broadcastPreferenceUpdate) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.getPreferences(sessionId)];
                    case 7:
                        savedPrefs = _h.sent();
                        if (savedPrefs) {
                            broadcastPreferenceUpdate(sessionId, {
                                userId: userId,
                                preferences: {
                                    intensity: savedPrefs.intensity || null,
                                    intensitySource: savedPrefs.intensitySource || null,
                                    muscleTargets: savedPrefs.muscleTargets || [],
                                    muscleLessens: savedPrefs.muscleLessens || [],
                                    includeExercises: savedPrefs.includeExercises || [],
                                    avoidExercises: savedPrefs.avoidExercises || [],
                                    avoidJoints: savedPrefs.avoidJoints || [],
                                    sessionGoal: savedPrefs.sessionGoal || null,
                                    sessionGoalSource: savedPrefs.sessionGoalSource || null,
                                }
                            });
                        }
                        logger.info("Broadcasted preference update", {
                            userId: userId,
                            sessionId: sessionId,
                            includeExercisesCount: ((_f = savedPrefs === null || savedPrefs === void 0 ? void 0 : savedPrefs.includeExercises) === null || _f === void 0 ? void 0 : _f.length) || 0,
                            avoidExercisesCount: ((_g = savedPrefs === null || savedPrefs === void 0 ? void 0 : savedPrefs.avoidExercises) === null || _g === void 0 ? void 0 : _g.length) || 0,
                            broadcastData: {
                                includeExercises: (savedPrefs === null || savedPrefs === void 0 ? void 0 : savedPrefs.includeExercises) || [],
                                avoidExercises: (savedPrefs === null || savedPrefs === void 0 ? void 0 : savedPrefs.avoidExercises) || []
                            }
                        });
                        _h.label = 8;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_3 = _h.sent();
                        logger.error("Error saving preferences:", error_3);
                        throw error_3;
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    WorkoutPreferenceService.getPreferences = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var preference, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, client_1.db
                                .select()
                                .from(schema_1.WorkoutPreferences)
                                .where((0, db_1.eq)(schema_1.WorkoutPreferences.trainingSessionId, sessionId))
                                .orderBy((0, db_1.desc)(schema_1.WorkoutPreferences.collectedAt))
                                .limit(1)];
                    case 1:
                        preference = (_a.sent())[0];
                        if (!preference) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, {
                                intensity: preference.intensity,
                                intensitySource: preference.intensitySource,
                                muscleTargets: preference.muscleTargets || [],
                                muscleLessens: preference.muscleLessens || [],
                                includeExercises: preference.includeExercises || [],
                                avoidExercises: preference.avoidExercises || [],
                                avoidJoints: preference.avoidJoints || [],
                                sessionGoal: preference.sessionGoal,
                                sessionGoalSource: preference.sessionGoalSource,
                            }];
                    case 2:
                        error_4 = _a.sent();
                        logger.error("Error getting preferences:", error_4);
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return WorkoutPreferenceService;
}());
exports.WorkoutPreferenceService = WorkoutPreferenceService;
