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
exports.WorkoutService = void 0;
var server_1 = require("@trpc/server");
var db_1 = require("@acme/db");
var schema_1 = require("@acme/db/schema");
var WorkoutService = /** @class */ (function () {
    function WorkoutService(db) {
        this.db = db;
    }
    /**
     * Verify that a training session exists and belongs to the user's business
     */
    WorkoutService.prototype.verifyTrainingSession = function (sessionId, businessId) {
        return __awaiter(this, void 0, void 0, function () {
            var session;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.query.TrainingSession.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.TrainingSession.id, sessionId), (0, db_1.eq)(schema_1.TrainingSession.businessId, businessId)),
                        })];
                    case 1:
                        session = _a.sent();
                        if (!session) {
                            throw new server_1.TRPCError({
                                code: 'NOT_FOUND',
                                message: 'Training session not found',
                            });
                        }
                        return [2 /*return*/, session];
                }
            });
        });
    };
    /**
     * Verify that a user is registered for a training session
     */
    WorkoutService.prototype.verifyUserRegistration = function (userId, sessionId, trainerId) {
        return __awaiter(this, void 0, void 0, function () {
            var registration;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Trainers don't need to be registered
                        if (userId === trainerId) {
                            return [2 /*return*/, true];
                        }
                        return [4 /*yield*/, this.db.query.UserTrainingSession.findFirst({
                                where: (0, db_1.and)((0, db_1.eq)(schema_1.UserTrainingSession.userId, userId), (0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, sessionId)),
                            })];
                    case 1:
                        registration = _a.sent();
                        if (!registration) {
                            throw new server_1.TRPCError({
                                code: 'FORBIDDEN',
                                message: 'User must be registered for the session to log a workout',
                            });
                        }
                        return [2 /*return*/, registration];
                }
            });
        });
    };
    /**
     * Verify that a user can log workouts for another user
     */
    WorkoutService.prototype.verifyWorkoutPermission = function (targetUserId, currentUser) {
        if (targetUserId !== currentUser.id && currentUser.role !== 'trainer') {
            throw new server_1.TRPCError({
                code: 'FORBIDDEN',
                message: 'You can only log your own workouts',
            });
        }
    };
    /**
     * Verify that a user has access to a workout
     * @returns The workout if access is granted
     */
    WorkoutService.prototype.verifyWorkoutAccess = function (workoutId, businessId) {
        return __awaiter(this, void 0, void 0, function () {
            var workout;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.query.Workout.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.Workout.id, workoutId), (0, db_1.eq)(schema_1.Workout.businessId, businessId)),
                        })];
                    case 1:
                        workout = _a.sent();
                        if (!workout) {
                            throw new server_1.TRPCError({
                                code: 'NOT_FOUND',
                                message: WorkoutService.ERRORS.WORKOUT_NOT_FOUND,
                            });
                        }
                        return [2 /*return*/, workout];
                }
            });
        });
    };
    /**
     * Verify that an exercise belongs to a workout
     */
    WorkoutService.prototype.verifyExerciseInWorkout = function (workoutId, exerciseId) {
        return __awaiter(this, void 0, void 0, function () {
            var exercise;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.query.WorkoutExercise.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.WorkoutExercise.workoutId, workoutId), (0, db_1.eq)(schema_1.WorkoutExercise.id, exerciseId)),
                        })];
                    case 1:
                        exercise = _a.sent();
                        if (!exercise) {
                            throw new server_1.TRPCError({
                                code: 'NOT_FOUND',
                                message: 'Exercise not found in workout',
                            });
                        }
                        return [2 /*return*/, exercise];
                }
            });
        });
    };
    /**
     * Get all exercises for a workout grouped by block
     */
    WorkoutService.prototype.getWorkoutExercisesGrouped = function (workoutId) {
        return __awaiter(this, void 0, void 0, function () {
            var workoutExercises, exercisesByBlock, _i, workoutExercises_1, exercise, blockName;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.query.WorkoutExercise.findMany({
                            where: (0, db_1.eq)(schema_1.WorkoutExercise.workoutId, workoutId),
                            orderBy: schema_1.WorkoutExercise.orderIndex,
                        })];
                    case 1:
                        workoutExercises = _a.sent();
                        exercisesByBlock = new Map();
                        for (_i = 0, workoutExercises_1 = workoutExercises; _i < workoutExercises_1.length; _i++) {
                            exercise = workoutExercises_1[_i];
                            blockName = exercise.groupName || 'Block A';
                            if (!exercisesByBlock.has(blockName)) {
                                exercisesByBlock.set(blockName, []);
                            }
                            exercisesByBlock.get(blockName).push(exercise);
                        }
                        return [2 /*return*/, exercisesByBlock];
                }
            });
        });
    };
    /**
     * Reorder exercises after deletion or reordering
     */
    WorkoutService.prototype.reorderExercises = function (workoutId, blockName, startIndex) {
        return __awaiter(this, void 0, void 0, function () {
            var exercises, i, exercise;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.query.WorkoutExercise.findMany({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.WorkoutExercise.workoutId, workoutId), (0, db_1.eq)(schema_1.WorkoutExercise.groupName, blockName)),
                            orderBy: schema_1.WorkoutExercise.orderIndex,
                        })];
                    case 1:
                        exercises = _a.sent();
                        i = startIndex;
                        _a.label = 2;
                    case 2:
                        if (!(i < exercises.length)) return [3 /*break*/, 5];
                        exercise = exercises[i];
                        if (!(exercise && exercise.orderIndex > startIndex)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.db
                                .update(schema_1.WorkoutExercise)
                                .set({ orderIndex: exercise.orderIndex - 1 })
                                .where((0, db_1.eq)(schema_1.WorkoutExercise.id, exercise.id))];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Verify that a client exists in the same business
     */
    WorkoutService.prototype.verifyClientInBusiness = function (clientId, businessId) {
        return __awaiter(this, void 0, void 0, function () {
            var client;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.query.user.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.user.id, clientId), (0, db_1.eq)(schema_1.user.businessId, businessId)),
                        })];
                    case 1:
                        client = _a.sent();
                        if (!client) {
                            throw new server_1.TRPCError({
                                code: 'NOT_FOUND',
                                message: 'Client not found in your business',
                            });
                        }
                        return [2 /*return*/, client];
                }
            });
        });
    };
    /**
     * Check if a workout is an assessment (can't be deleted)
     */
    WorkoutService.prototype.isAssessmentWorkout = function (workout) {
        return workout.context === 'assessment';
    };
    /**
     * Create a workout for a training session
     */
    WorkoutService.prototype.createWorkoutForSession = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var trainingSessionId, userId, businessId, createdByTrainerId, completedAt, notes, exercises;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        trainingSessionId = params.trainingSessionId, userId = params.userId, businessId = params.businessId, createdByTrainerId = params.createdByTrainerId, completedAt = params.completedAt, notes = params.notes, exercises = params.exercises;
                        return [4 /*yield*/, this.db.transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                var workout;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, tx
                                                .insert(schema_1.Workout)
                                                .values({
                                                trainingSessionId: trainingSessionId,
                                                userId: userId,
                                                businessId: businessId,
                                                createdByTrainerId: createdByTrainerId,
                                                completedAt: completedAt,
                                                notes: notes,
                                                context: "group", // Group context since it has a training session
                                            })
                                                .returning()];
                                        case 1:
                                            workout = (_a.sent())[0];
                                            if (!workout) {
                                                throw new server_1.TRPCError({
                                                    code: 'INTERNAL_SERVER_ERROR',
                                                    message: 'Failed to create workout',
                                                });
                                            }
                                            if (!(exercises && exercises.length > 0)) return [3 /*break*/, 3];
                                            return [4 /*yield*/, tx.insert(schema_1.WorkoutExercise).values(exercises.map(function (ex) { return ({
                                                    workoutId: workout.id,
                                                    exerciseId: ex.exerciseId,
                                                    orderIndex: ex.orderIndex,
                                                    setsCompleted: ex.setsCompleted,
                                                    groupName: "Block A", // Default for now
                                                }); }))];
                                        case 2:
                                            _a.sent();
                                            _a.label = 3;
                                        case 3: return [2 /*return*/, workout];
                                    }
                                });
                            }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Standard error messages
     */
    WorkoutService.ERRORS = {
        WORKOUT_NOT_FOUND: 'Workout not found',
        SESSION_NOT_FOUND: 'Training session not found',
        UNAUTHORIZED: 'Unauthorized',
        FORBIDDEN: 'You do not have permission to perform this action',
        INVALID_INPUT: 'Invalid input provided',
        BUSINESS_REQUIRED: 'User must be associated with a business',
    };
    return WorkoutService;
}());
exports.WorkoutService = WorkoutService;
