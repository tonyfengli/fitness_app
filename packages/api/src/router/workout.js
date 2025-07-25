"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
exports.workoutRouter = void 0;
var zod_1 = require("zod");
var server_1 = require("@trpc/server");
var db_1 = require("@acme/db");
var schema_1 = require("@acme/db/schema");
var trpc_1 = require("../trpc");
var workout_service_1 = require("../services/workout-service");
var llm_workout_service_1 = require("../services/llm-workout-service");
var validation_1 = require("../utils/validation");
var query_helpers_1 = require("../utils/query-helpers");
var session_1 = require("../utils/session");
exports.workoutRouter = {
    // Create a workout for a training session
    create: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        trainingSessionId: zod_1.z.string().uuid(), // Required for this endpoint
        userId: zod_1.z.string().optional(),
        completedAt: zod_1.z.date(),
        notes: zod_1.z.string().optional(),
        exercises: zod_1.z.array(zod_1.z.object({
            exerciseId: zod_1.z.string().uuid(),
            orderIndex: zod_1.z.number().int().min(1),
            setsCompleted: zod_1.z.number().int().min(1),
        })).optional(),
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, businessId, workoutService, session, targetUserId, workout;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUserWithBusiness)(ctx);
                    businessId = currentUser.businessId;
                    workoutService = new workout_service_1.WorkoutService(ctx.db);
                    return [4 /*yield*/, workoutService.verifyTrainingSession(input.trainingSessionId, businessId)];
                case 1:
                    session = _c.sent();
                    targetUserId = input.userId || currentUser.id;
                    if (!(currentUser.id !== session.trainerId)) return [3 /*break*/, 3];
                    return [4 /*yield*/, workoutService.verifyUserRegistration(targetUserId, input.trainingSessionId, session.trainerId)];
                case 2:
                    _c.sent();
                    _c.label = 3;
                case 3:
                    // Verify permission to log workouts
                    workoutService.verifyWorkoutPermission(targetUserId, currentUser);
                    return [4 /*yield*/, workoutService.createWorkoutForSession({
                            trainingSessionId: input.trainingSessionId,
                            userId: targetUserId,
                            businessId: businessId,
                            createdByTrainerId: currentUser.id,
                            completedAt: input.completedAt,
                            notes: input.notes,
                            exercises: input.exercises,
                        })];
                case 4:
                    workout = _c.sent();
                    return [2 /*return*/, workout];
            }
        });
    }); }),
    // Add exercises to an existing workout
    addExercises: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        workoutId: zod_1.z.string().uuid(),
        exercises: zod_1.z.array(zod_1.z.object({
            exerciseId: zod_1.z.string().uuid(),
            orderIndex: zod_1.z.number().int().min(1),
            setsCompleted: zod_1.z.number().int().min(1),
        })),
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, workout, workoutData, results;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUser)(ctx);
                    return [4 /*yield*/, ctx.db
                            .select({
                            workout: schema_1.Workout,
                            trainingSession: schema_1.TrainingSession,
                        })
                            .from(schema_1.Workout)
                            .innerJoin(schema_1.TrainingSession, (0, db_1.eq)(schema_1.Workout.trainingSessionId, schema_1.TrainingSession.id))
                            .where((0, db_1.eq)(schema_1.Workout.id, input.workoutId))
                            .limit(1)];
                case 1:
                    workout = _c.sent();
                    workoutData = workout[0];
                    if (!workoutData) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Workout not found',
                        });
                    }
                    // Check business scope
                    if (workoutData.trainingSession.businessId !== currentUser.businessId) {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'Access denied',
                        });
                    }
                    // Only workout owner or trainer can add exercises
                    if (workoutData.workout.userId !== currentUser.id && currentUser.role !== 'trainer') {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'You can only modify your own workouts',
                        });
                    }
                    // Additional check for trainers - ensure they can only modify workouts for their business
                    if (currentUser.role === 'trainer' && workoutData.trainingSession.businessId !== currentUser.businessId) {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'You can only modify workouts within your business',
                        });
                    }
                    return [4 /*yield*/, ctx.db.transaction(function (tx) { return __awaiter(void 0, void 0, void 0, function () {
                            var exerciseIds, validExercises;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        exerciseIds = input.exercises.map(function (ex) { return ex.exerciseId; });
                                        return [4 /*yield*/, tx
                                                .select({ id: schema_1.exercises.id })
                                                .from(schema_1.exercises)
                                                .innerJoin(schema_1.BusinessExercise, (0, db_1.eq)(schema_1.exercises.id, schema_1.BusinessExercise.exerciseId))
                                                .where((0, db_1.and)((0, db_1.eq)(schema_1.BusinessExercise.businessId, currentUser.businessId), (0, db_1.inArray)(schema_1.exercises.id, exerciseIds)))];
                                    case 1:
                                        validExercises = _a.sent();
                                        if (validExercises.length !== exerciseIds.length) {
                                            throw new server_1.TRPCError({
                                                code: 'BAD_REQUEST',
                                                message: 'One or more exercises are invalid or not available for your business',
                                            });
                                        }
                                        return [4 /*yield*/, tx
                                                .insert(schema_1.WorkoutExercise)
                                                .values(input.exercises.map(function (ex) { return ({
                                                workoutId: input.workoutId,
                                                exerciseId: ex.exerciseId,
                                                orderIndex: ex.orderIndex,
                                                setsCompleted: ex.setsCompleted,
                                            }); }))
                                                .returning()];
                                    case 2: 
                                    // Insert all exercises
                                    return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); })];
                case 2:
                    results = _c.sent();
                    return [2 /*return*/, results];
            }
        });
    }); }),
    // Get user's workout history
    myWorkouts: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        limit: zod_1.z.number().min(1).max(100).default(20),
        offset: zod_1.z.number().min(0).default(0),
    }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, workouts;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUser)(ctx);
                    return [4 /*yield*/, ctx.db
                            .select({
                            workout: schema_1.Workout,
                            trainingSession: {
                                id: schema_1.TrainingSession.id,
                                name: schema_1.TrainingSession.name,
                                scheduledAt: schema_1.TrainingSession.scheduledAt,
                                trainerId: schema_1.TrainingSession.trainerId,
                            },
                            exerciseCount: (0, db_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["count(", ")::int"], ["count(", ")::int"])), schema_1.WorkoutExercise.id),
                        })
                            .from(schema_1.Workout)
                            .innerJoin(schema_1.TrainingSession, (0, db_1.eq)(schema_1.Workout.trainingSessionId, schema_1.TrainingSession.id))
                            .leftJoin(schema_1.WorkoutExercise, (0, db_1.eq)(schema_1.WorkoutExercise.workoutId, schema_1.Workout.id))
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.Workout.userId, currentUser.id), (0, db_1.eq)(schema_1.TrainingSession.businessId, currentUser.businessId)))
                            .groupBy(schema_1.Workout.id, schema_1.TrainingSession.id, schema_1.TrainingSession.name, schema_1.TrainingSession.scheduledAt, schema_1.TrainingSession.trainerId)
                            .orderBy((0, db_1.desc)(schema_1.Workout.completedAt))
                            .limit(input.limit)
                            .offset(input.offset)];
                case 1:
                    workouts = _c.sent();
                    return [2 /*return*/, workouts];
            }
        });
    }); }),
    // Get a specific workout with exercises
    getById: trpc_1.protectedProcedure
        .input(zod_1.z.object({ id: zod_1.z.string().uuid() }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, workoutResult, workout, workoutExercises;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUser)(ctx);
                    return [4 /*yield*/, ctx.db
                            .select({
                            workout: schema_1.Workout,
                            trainingSession: schema_1.TrainingSession,
                        })
                            .from(schema_1.Workout)
                            .leftJoin(schema_1.TrainingSession, (0, db_1.eq)(schema_1.Workout.trainingSessionId, schema_1.TrainingSession.id))
                            .where((0, db_1.eq)(schema_1.Workout.id, input.id))
                            .limit(1)];
                case 1:
                    workoutResult = _c.sent();
                    workout = workoutResult[0];
                    if (!workout) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Workout not found',
                        });
                    }
                    // Check business scope - use workout's businessId directly
                    if (workout.workout.businessId !== currentUser.businessId) {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'Access denied',
                        });
                    }
                    // Check access: user can see their own workouts, trainers can see all
                    if (workout.workout.userId !== currentUser.id && currentUser.role !== 'trainer') {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'You can only view your own workouts',
                        });
                    }
                    return [4 /*yield*/, ctx.db
                            .select({
                            id: schema_1.WorkoutExercise.id,
                            orderIndex: schema_1.WorkoutExercise.orderIndex,
                            setsCompleted: schema_1.WorkoutExercise.setsCompleted,
                            groupName: schema_1.WorkoutExercise.groupName,
                            createdAt: schema_1.WorkoutExercise.createdAt,
                            exercise: {
                                id: schema_1.exercises.id,
                                name: schema_1.exercises.name,
                                primaryMuscle: schema_1.exercises.primaryMuscle,
                                secondaryMuscles: schema_1.exercises.secondaryMuscles,
                                movementPattern: schema_1.exercises.movementPattern,
                                modality: schema_1.exercises.modality,
                                equipment: schema_1.exercises.equipment,
                            },
                        })
                            .from(schema_1.WorkoutExercise)
                            .innerJoin(schema_1.exercises, (0, db_1.eq)(schema_1.WorkoutExercise.exerciseId, schema_1.exercises.id))
                            .where((0, db_1.eq)(schema_1.WorkoutExercise.workoutId, input.id))
                            .orderBy(schema_1.WorkoutExercise.orderIndex)];
                case 2:
                    workoutExercises = _c.sent();
                    return [2 /*return*/, __assign(__assign({}, workout.workout), { trainingSession: workout.trainingSession, exercises: workoutExercises })];
            }
        });
    }); }),
    // Trainer views client's workouts
    clientWorkouts: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        clientId: zod_1.z.string(),
        limit: zod_1.z.number().min(1).max(100).default(20),
        offset: zod_1.z.number().min(0).default(0),
    }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, client, workouts;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getTrainerUser)(ctx);
                    return [4 /*yield*/, (0, validation_1.verifyClientInBusiness)(ctx.db, input.clientId, currentUser.businessId)];
                case 1:
                    client = _c.sent();
                    return [4 /*yield*/, ctx.db
                            .select({
                            workout: schema_1.Workout,
                            trainingSession: {
                                id: schema_1.TrainingSession.id,
                                name: schema_1.TrainingSession.name,
                                scheduledAt: schema_1.TrainingSession.scheduledAt,
                            },
                            exerciseCount: (0, db_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["count(", ")::int"], ["count(", ")::int"])), schema_1.WorkoutExercise.id),
                        })
                            .from(schema_1.Workout)
                            .innerJoin(schema_1.TrainingSession, (0, db_1.eq)(schema_1.Workout.trainingSessionId, schema_1.TrainingSession.id))
                            .leftJoin(schema_1.WorkoutExercise, (0, db_1.eq)(schema_1.WorkoutExercise.workoutId, schema_1.Workout.id))
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.Workout.userId, input.clientId), (0, db_1.eq)(schema_1.TrainingSession.businessId, currentUser.businessId)))
                            .groupBy(schema_1.Workout.id, schema_1.TrainingSession.id, schema_1.TrainingSession.name, schema_1.TrainingSession.scheduledAt)
                            .orderBy((0, db_1.desc)(schema_1.Workout.completedAt))
                            .limit(input.limit)
                            .offset(input.offset)];
                case 2:
                    workouts = _c.sent();
                    return [2 /*return*/, workouts];
            }
        });
    }); }),
    // Get all workouts for a training session
    sessionWorkouts: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        sessionId: zod_1.z.string().uuid(),
    }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, session, conditions, workouts;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUser)(ctx);
                    return [4 /*yield*/, ctx.db.query.TrainingSession.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.TrainingSession.id, input.sessionId), (0, db_1.eq)(schema_1.TrainingSession.businessId, currentUser.businessId)),
                        })];
                case 1:
                    session = _c.sent();
                    if (!session) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Training session not found',
                        });
                    }
                    conditions = [(0, db_1.eq)(schema_1.Workout.trainingSessionId, input.sessionId)];
                    if (currentUser.role !== 'trainer') {
                        conditions.push((0, db_1.eq)(schema_1.Workout.userId, currentUser.id));
                    }
                    return [4 /*yield*/, ctx.db
                            .select({
                            workout: schema_1.Workout,
                            user: {
                                id: schema_1.user.id,
                                name: schema_1.user.name,
                                email: schema_1.user.email,
                            },
                            exerciseCount: (0, db_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["count(", ")::int"], ["count(", ")::int"])), schema_1.WorkoutExercise.id),
                        })
                            .from(schema_1.Workout)
                            .innerJoin(schema_1.user, (0, db_1.eq)(schema_1.Workout.userId, schema_1.user.id))
                            .leftJoin(schema_1.WorkoutExercise, (0, db_1.eq)(schema_1.WorkoutExercise.workoutId, schema_1.Workout.id))
                            .where(db_1.and.apply(void 0, conditions))
                            .groupBy(schema_1.Workout.id, schema_1.user.id, schema_1.user.name, schema_1.user.email)
                            .orderBy((0, db_1.desc)(schema_1.Workout.completedAt))];
                case 2:
                    workouts = _c.sent();
                    return [2 /*return*/, workouts];
            }
        });
    }); }),
    // Save LLM-generated workout
    saveWorkout: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        trainingSessionId: zod_1.z.string().uuid(),
        userId: zod_1.z.string(), // Client user ID
        llmOutput: zod_1.z.any(), // Raw LLM response
        workoutType: zod_1.z.string().optional(), // Optional, will be extracted from transformer
        workoutName: zod_1.z.string().optional(),
        workoutDescription: zod_1.z.string().optional(),
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, businessId, workoutService, client, llmWorkoutService, result;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUserWithBusiness)(ctx);
                    businessId = currentUser.businessId;
                    workoutService = new workout_service_1.WorkoutService(ctx.db);
                    return [4 /*yield*/, workoutService.verifyTrainingSession(input.trainingSessionId, businessId)];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, (0, validation_1.verifyClientInBusiness)(ctx.db, input.userId, businessId)];
                case 2:
                    client = _c.sent();
                    llmWorkoutService = new llm_workout_service_1.LLMWorkoutService(ctx.db);
                    return [4 /*yield*/, llmWorkoutService.saveWorkout({
                            trainingSessionId: input.trainingSessionId,
                            userId: input.userId,
                            businessId: businessId,
                            createdByTrainerId: currentUser.id,
                            llmOutput: input.llmOutput,
                            workoutType: input.workoutType,
                            workoutName: input.workoutName,
                            workoutDescription: input.workoutDescription,
                        }, client.name)];
                case 3:
                    result = _c.sent();
                    return [2 /*return*/, result];
            }
        });
    }); }),
    // Get client's latest workouts with exercises for trainer dashboard
    getClientWorkoutsWithExercises: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        clientId: zod_1.z.string(),
        limit: zod_1.z.number().min(1).max(10).default(3),
    }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, client, workoutsWithExercises;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUser)(ctx);
                    // Only trainers can view other users' workouts
                    (0, validation_1.requireTrainerRole)(currentUser);
                    return [4 /*yield*/, (0, validation_1.verifyClientInBusiness)(ctx.db, input.clientId, currentUser.businessId)];
                case 1:
                    client = _c.sent();
                    return [4 /*yield*/, (0, query_helpers_1.withPerformanceMonitoring)('getClientWorkoutsWithExercises', function () { return (0, query_helpers_1.getWorkoutsWithExercisesOptimized)(ctx.db, {
                            userId: input.clientId,
                            businessId: currentUser.businessId,
                            limit: input.limit,
                        }); })];
                case 2:
                    workoutsWithExercises = _c.sent();
                    return [2 /*return*/, workoutsWithExercises];
            }
        });
    }); }),
    // Generate individual workout (no training session required)
    generateIndividual: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        userId: zod_1.z.string(), // Client user ID
        templateType: zod_1.z.enum(["standard", "circuit", "full_body"]),
        exercises: zod_1.z.record(zod_1.z.any()), // LLM output object with blocks
        workoutName: zod_1.z.string().optional(),
        workoutDescription: zod_1.z.string().optional(),
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, client, llmWorkoutService, result;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUserWithBusiness)(ctx);
                    return [4 /*yield*/, (0, validation_1.verifyClientInBusiness)(ctx.db, input.userId, currentUser.businessId)];
                case 1:
                    client = _c.sent();
                    llmWorkoutService = new llm_workout_service_1.LLMWorkoutService(ctx.db);
                    return [4 /*yield*/, llmWorkoutService.saveIndividualWorkout({
                            userId: input.userId,
                            businessId: currentUser.businessId,
                            createdByTrainerId: currentUser.id,
                            llmOutput: input.exercises,
                            workoutType: input.templateType,
                            workoutName: input.workoutName,
                            workoutDescription: input.workoutDescription || "Individual workout for ".concat(client.name || client.email),
                            templateType: input.templateType,
                            context: "individual",
                        }, client.name)];
                case 2:
                    result = _c.sent();
                    return [2 /*return*/, result];
            }
        });
    }); }),
    // Delete a specific exercise from a workout
    deleteExercise: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        workoutId: zod_1.z.string().uuid(),
        workoutExerciseId: zod_1.z.string().uuid()
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, workoutService;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUser)(ctx);
                    workoutService = new workout_service_1.WorkoutService(ctx.db);
                    return [4 /*yield*/, workoutService.verifyWorkoutAccess(input.workoutId, currentUser.businessId)];
                case 1:
                    _c.sent();
                    // Use transaction to delete and reorder
                    return [4 /*yield*/, ctx.db.transaction(function (tx) { return __awaiter(void 0, void 0, void 0, function () {
                            var exerciseToDelete;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, tx.query.WorkoutExercise.findFirst({
                                            where: (0, db_1.and)((0, db_1.eq)(schema_1.WorkoutExercise.id, input.workoutExerciseId), (0, db_1.eq)(schema_1.WorkoutExercise.workoutId, input.workoutId)),
                                        })];
                                    case 1:
                                        exerciseToDelete = _a.sent();
                                        if (!exerciseToDelete) {
                                            throw new server_1.TRPCError({
                                                code: 'NOT_FOUND',
                                                message: 'Exercise not found in workout',
                                            });
                                        }
                                        // Delete the exercise
                                        return [4 /*yield*/, tx.delete(schema_1.WorkoutExercise)
                                                .where((0, db_1.eq)(schema_1.WorkoutExercise.id, input.workoutExerciseId))];
                                    case 2:
                                        // Delete the exercise
                                        _a.sent();
                                        if (!(exerciseToDelete.groupName !== null)) return [3 /*break*/, 4];
                                        return [4 /*yield*/, tx.update(schema_1.WorkoutExercise)
                                                .set({ orderIndex: (0, db_1.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["", " - 1"], ["", " - 1"])), schema_1.WorkoutExercise.orderIndex) })
                                                .where((0, db_1.and)((0, db_1.eq)(schema_1.WorkoutExercise.workoutId, input.workoutId), (0, db_1.eq)(schema_1.WorkoutExercise.groupName, exerciseToDelete.groupName), (0, db_1.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["", " > ", ""], ["", " > ", ""])), schema_1.WorkoutExercise.orderIndex, exerciseToDelete.orderIndex)))];
                                    case 3:
                                        _a.sent();
                                        return [3 /*break*/, 6];
                                    case 4: 
                                    // Handle case where groupName is null
                                    return [4 /*yield*/, tx.update(schema_1.WorkoutExercise)
                                            .set({ orderIndex: (0, db_1.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["", " - 1"], ["", " - 1"])), schema_1.WorkoutExercise.orderIndex) })
                                            .where((0, db_1.and)((0, db_1.eq)(schema_1.WorkoutExercise.workoutId, input.workoutId), (0, db_1.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["", " IS NULL"], ["", " IS NULL"])), schema_1.WorkoutExercise.groupName), (0, db_1.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["", " > ", ""], ["", " > ", ""])), schema_1.WorkoutExercise.orderIndex, exerciseToDelete.orderIndex)))];
                                    case 5:
                                        // Handle case where groupName is null
                                        _a.sent();
                                        _a.label = 6;
                                    case 6: return [2 /*return*/];
                                }
                            });
                        }); })];
                case 2:
                    // Use transaction to delete and reorder
                    _c.sent();
                    return [2 /*return*/, { success: true }];
            }
        });
    }); }),
    // Update exercise order within the same block
    updateExerciseOrder: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        workoutId: zod_1.z.string().uuid(),
        workoutExerciseId: zod_1.z.string().uuid(),
        direction: zod_1.z.enum(['up', 'down'])
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, workoutService, workoutExercises, exerciseIndex, exercise, groupExercises, currentGroupIndex, targetGroupIndex, targetExercise;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUser)(ctx);
                    workoutService = new workout_service_1.WorkoutService(ctx.db);
                    return [4 /*yield*/, workoutService.verifyWorkoutAccess(input.workoutId, currentUser.businessId)];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, ctx.db.query.WorkoutExercise.findMany({
                            where: (0, db_1.eq)(schema_1.WorkoutExercise.workoutId, input.workoutId),
                            orderBy: [schema_1.WorkoutExercise.orderIndex],
                        })];
                case 2:
                    workoutExercises = _c.sent();
                    exerciseIndex = workoutExercises.findIndex(function (ex) { return ex.id === input.workoutExerciseId; });
                    if (exerciseIndex === -1) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Exercise not found in workout',
                        });
                    }
                    exercise = workoutExercises[exerciseIndex];
                    if (!exercise) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Exercise not found in workout',
                        });
                    }
                    groupExercises = workoutExercises
                        .filter(function (ex) { return ex.groupName === exercise.groupName; })
                        .sort(function (a, b) { return a.orderIndex - b.orderIndex; });
                    currentGroupIndex = groupExercises.findIndex(function (ex) { return ex.id === input.workoutExerciseId; });
                    targetGroupIndex = input.direction === 'up' ? currentGroupIndex - 1 : currentGroupIndex + 1;
                    // Check if move is valid
                    if (targetGroupIndex < 0 || targetGroupIndex >= groupExercises.length) {
                        throw new server_1.TRPCError({
                            code: 'BAD_REQUEST',
                            message: "Cannot move exercise ".concat(input.direction, " - already at boundary"),
                        });
                    }
                    targetExercise = groupExercises[targetGroupIndex];
                    if (!targetExercise) {
                        throw new server_1.TRPCError({
                            code: 'INTERNAL_SERVER_ERROR',
                            message: 'Target exercise not found',
                        });
                    }
                    return [4 /*yield*/, ctx.db.transaction(function (tx) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: 
                                    // Swap orderIndex values
                                    return [4 /*yield*/, tx.update(schema_1.WorkoutExercise)
                                            .set({ orderIndex: targetExercise.orderIndex })
                                            .where((0, db_1.eq)(schema_1.WorkoutExercise.id, exercise.id))];
                                    case 1:
                                        // Swap orderIndex values
                                        _a.sent();
                                        return [4 /*yield*/, tx.update(schema_1.WorkoutExercise)
                                                .set({ orderIndex: exercise.orderIndex })
                                                .where((0, db_1.eq)(schema_1.WorkoutExercise.id, targetExercise.id))];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 3:
                    _c.sent();
                    return [2 /*return*/, { success: true }];
            }
        });
    }); }),
    // Delete all exercises in a block/group
    deleteBlock: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        workoutId: zod_1.z.string().uuid(),
        groupName: zod_1.z.string()
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, workoutService, allExercises, uniqueGroups;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUser)(ctx);
                    workoutService = new workout_service_1.WorkoutService(ctx.db);
                    return [4 /*yield*/, workoutService.verifyWorkoutAccess(input.workoutId, currentUser.businessId)];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, ctx.db.query.WorkoutExercise.findMany({
                            where: (0, db_1.eq)(schema_1.WorkoutExercise.workoutId, input.workoutId),
                        })];
                case 2:
                    allExercises = _c.sent();
                    uniqueGroups = new Set(allExercises.map(function (ex) { return ex.groupName; }));
                    if (uniqueGroups.size <= 1) {
                        throw new server_1.TRPCError({
                            code: 'BAD_REQUEST',
                            message: 'Cannot delete the only remaining block',
                        });
                    }
                    // Delete all exercises in the block
                    return [4 /*yield*/, ctx.db.delete(schema_1.WorkoutExercise)
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.WorkoutExercise.workoutId, input.workoutId), (0, db_1.eq)(schema_1.WorkoutExercise.groupName, input.groupName)))];
                case 3:
                    // Delete all exercises in the block
                    _c.sent();
                    return [2 /*return*/, { success: true }];
            }
        });
    }); }),
    // Delete entire workout
    deleteWorkout: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        workoutId: zod_1.z.string().uuid()
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, workoutService, workout;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUser)(ctx);
                    workoutService = new workout_service_1.WorkoutService(ctx.db);
                    return [4 /*yield*/, workoutService.verifyWorkoutAccess(input.workoutId, currentUser.businessId)];
                case 1:
                    workout = _c.sent();
                    // Check if this is an assessment workout (which shouldn't be deleted)
                    if (workout.context === 'assessment') {
                        throw new server_1.TRPCError({
                            code: 'BAD_REQUEST',
                            message: 'Assessment workouts cannot be deleted',
                        });
                    }
                    // Delete workout (cascade will handle WorkoutExercise deletion)
                    return [4 /*yield*/, ctx.db.delete(schema_1.Workout)
                            .where((0, db_1.eq)(schema_1.Workout.id, input.workoutId))];
                case 2:
                    // Delete workout (cascade will handle WorkoutExercise deletion)
                    _c.sent();
                    return [2 /*return*/, { success: true }];
            }
        });
    }); }),
    // Replace an exercise with another one
    replaceExercise: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        workoutId: zod_1.z.string().uuid(),
        workoutExerciseId: zod_1.z.string().uuid(),
        newExerciseId: zod_1.z.string().uuid()
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, workoutService, workoutExercise, newExercise;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUser)(ctx);
                    workoutService = new workout_service_1.WorkoutService(ctx.db);
                    return [4 /*yield*/, workoutService.verifyWorkoutAccess(input.workoutId, currentUser.businessId)];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, ctx.db.query.WorkoutExercise.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.WorkoutExercise.id, input.workoutExerciseId), (0, db_1.eq)(schema_1.WorkoutExercise.workoutId, input.workoutId)),
                        })];
                case 2:
                    workoutExercise = _c.sent();
                    if (!workoutExercise) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Exercise not found in workout',
                        });
                    }
                    return [4 /*yield*/, ctx.db
                            .select({
                            exercise: schema_1.exercises,
                        })
                            .from(schema_1.exercises)
                            .innerJoin(schema_1.BusinessExercise, (0, db_1.eq)(schema_1.exercises.id, schema_1.BusinessExercise.exerciseId))
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.exercises.id, input.newExerciseId), (0, db_1.eq)(schema_1.BusinessExercise.businessId, currentUser.businessId)))
                            .limit(1)];
                case 3:
                    newExercise = _c.sent();
                    if (!newExercise[0]) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'New exercise not found or not available for your business',
                        });
                    }
                    // Update the exercise
                    return [4 /*yield*/, ctx.db.update(schema_1.WorkoutExercise)
                            .set({ exerciseId: input.newExerciseId })
                            .where((0, db_1.eq)(schema_1.WorkoutExercise.id, input.workoutExerciseId))];
                case 4:
                    // Update the exercise
                    _c.sent();
                    return [2 /*return*/, { success: true }];
            }
        });
    }); }),
    // Update exercise sets
    updateExerciseSets: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        workoutId: zod_1.z.string().uuid(),
        workoutExerciseId: zod_1.z.string().uuid(),
        sets: zod_1.z.number().int().min(1).max(10)
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, workoutService, workoutExercise;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUser)(ctx);
                    workoutService = new workout_service_1.WorkoutService(ctx.db);
                    return [4 /*yield*/, workoutService.verifyWorkoutAccess(input.workoutId, currentUser.businessId)];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, ctx.db.query.WorkoutExercise.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.WorkoutExercise.id, input.workoutExerciseId), (0, db_1.eq)(schema_1.WorkoutExercise.workoutId, input.workoutId)),
                        })];
                case 2:
                    workoutExercise = _c.sent();
                    if (!workoutExercise) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Exercise not found in workout',
                        });
                    }
                    // Update the sets
                    return [4 /*yield*/, ctx.db.update(schema_1.WorkoutExercise)
                            .set({ setsCompleted: input.sets })
                            .where((0, db_1.eq)(schema_1.WorkoutExercise.id, input.workoutExerciseId))];
                case 3:
                    // Update the sets
                    _c.sent();
                    return [2 /*return*/, { success: true }];
            }
        });
    }); }),
    // Add a new exercise to an existing workout
    addExercise: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        workoutId: zod_1.z.string().uuid(),
        exerciseId: zod_1.z.string().uuid(),
        groupName: zod_1.z.string(),
        position: zod_1.z.enum(['beginning', 'end']).default('end'),
        sets: zod_1.z.number().int().min(1).default(3)
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, workoutService, exercise, existingExercises, groupExercises, newOrderIndex;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUser)(ctx);
                    workoutService = new workout_service_1.WorkoutService(ctx.db);
                    return [4 /*yield*/, workoutService.verifyWorkoutAccess(input.workoutId, currentUser.businessId)];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, ctx.db
                            .select({
                            exercise: schema_1.exercises,
                        })
                            .from(schema_1.exercises)
                            .innerJoin(schema_1.BusinessExercise, (0, db_1.eq)(schema_1.exercises.id, schema_1.BusinessExercise.exerciseId))
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.exercises.id, input.exerciseId), (0, db_1.eq)(schema_1.BusinessExercise.businessId, currentUser.businessId)))
                            .limit(1)];
                case 2:
                    exercise = _c.sent();
                    if (!exercise[0]) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Exercise not found or not available for your business',
                        });
                    }
                    return [4 /*yield*/, ctx.db.query.WorkoutExercise.findMany({
                            where: (0, db_1.eq)(schema_1.WorkoutExercise.workoutId, input.workoutId),
                            orderBy: [schema_1.WorkoutExercise.orderIndex],
                        })];
                case 3:
                    existingExercises = _c.sent();
                    groupExercises = existingExercises.filter(function (ex) { return ex.groupName === input.groupName; });
                    if (!(input.position === 'beginning' && groupExercises.length > 0)) return [3 /*break*/, 5];
                    // Insert at beginning of group
                    newOrderIndex = groupExercises[0].orderIndex;
                    // Shift all exercises in workout with orderIndex >= newOrderIndex
                    return [4 /*yield*/, ctx.db.transaction(function (tx) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: 
                                    // Increment orderIndex for all exercises at or after the insertion point
                                    return [4 /*yield*/, tx.update(schema_1.WorkoutExercise)
                                            .set({ orderIndex: (0, db_1.sql)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["", " + 1"], ["", " + 1"])), schema_1.WorkoutExercise.orderIndex) })
                                            .where((0, db_1.and)((0, db_1.eq)(schema_1.WorkoutExercise.workoutId, input.workoutId), (0, db_1.sql)(templateObject_10 || (templateObject_10 = __makeTemplateObject(["", " >= ", ""], ["", " >= ", ""])), schema_1.WorkoutExercise.orderIndex, newOrderIndex)))];
                                    case 1:
                                        // Increment orderIndex for all exercises at or after the insertion point
                                        _a.sent();
                                        // Insert the new exercise
                                        return [4 /*yield*/, tx.insert(schema_1.WorkoutExercise)
                                                .values({
                                                workoutId: input.workoutId,
                                                exerciseId: input.exerciseId,
                                                orderIndex: newOrderIndex,
                                                setsCompleted: input.sets,
                                                groupName: input.groupName,
                                            })];
                                    case 2:
                                        // Insert the new exercise
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 4:
                    // Shift all exercises in workout with orderIndex >= newOrderIndex
                    _c.sent();
                    return [3 /*break*/, 7];
                case 5:
                    // Insert at end of group or as first exercise in new/empty group
                    if (groupExercises.length > 0) {
                        newOrderIndex = groupExercises[groupExercises.length - 1].orderIndex + 1;
                    }
                    else if (existingExercises.length > 0) {
                        newOrderIndex = existingExercises[existingExercises.length - 1].orderIndex + 1;
                    }
                    else {
                        newOrderIndex = 1;
                    }
                    // Insert the new exercise
                    return [4 /*yield*/, ctx.db.insert(schema_1.WorkoutExercise)
                            .values({
                            workoutId: input.workoutId,
                            exerciseId: input.exerciseId,
                            orderIndex: newOrderIndex,
                            setsCompleted: input.sets,
                            groupName: input.groupName,
                        })];
                case 6:
                    // Insert the new exercise
                    _c.sent();
                    _c.label = 7;
                case 7: return [2 /*return*/, { success: true }];
            }
        });
    }); }),
    // Duplicate an existing workout
    duplicateWorkout: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        workoutId: zod_1.z.string().uuid(),
        targetUserId: zod_1.z.string().optional(), // If not provided, duplicate for same user
        notes: zod_1.z.string().optional()
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, originalWorkout, targetUserId, targetUser, originalExercises, result;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    currentUser = (0, session_1.getSessionUser)(ctx);
                    return [4 /*yield*/, ctx.db.query.Workout.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.Workout.id, input.workoutId), (0, db_1.eq)(schema_1.Workout.businessId, currentUser.businessId)),
                        })];
                case 1:
                    originalWorkout = _c.sent();
                    if (!originalWorkout) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Workout not found',
                        });
                    }
                    targetUserId = input.targetUserId || originalWorkout.userId;
                    if (!(targetUserId !== originalWorkout.userId)) return [3 /*break*/, 3];
                    return [4 /*yield*/, ctx.db.query.user.findFirst({
                            where: (0, db_1.eq)(schema_1.user.id, targetUserId),
                        })];
                case 2:
                    targetUser = _c.sent();
                    if (!targetUser || targetUser.businessId !== currentUser.businessId) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Target user not found in your business',
                        });
                    }
                    _c.label = 3;
                case 3: return [4 /*yield*/, ctx.db.query.WorkoutExercise.findMany({
                        where: (0, db_1.eq)(schema_1.WorkoutExercise.workoutId, input.workoutId),
                        orderBy: [schema_1.WorkoutExercise.orderIndex],
                    })];
                case 4:
                    originalExercises = _c.sent();
                    return [4 /*yield*/, ctx.db.transaction(function (tx) { return __awaiter(void 0, void 0, void 0, function () {
                            var newWorkout;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, tx
                                            .insert(schema_1.Workout)
                                            .values({
                                            trainingSessionId: originalWorkout.trainingSessionId,
                                            userId: targetUserId,
                                            businessId: currentUser.businessId,
                                            createdByTrainerId: currentUser.id,
                                            completedAt: null, // New workout starts uncompleted
                                            notes: input.notes || "Duplicated from workout on ".concat(new Date().toLocaleDateString()),
                                            workoutType: originalWorkout.workoutType,
                                            totalPlannedSets: originalWorkout.totalPlannedSets,
                                            llmOutput: originalWorkout.llmOutput,
                                            templateConfig: originalWorkout.templateConfig,
                                            context: originalWorkout.context,
                                        })
                                            .returning()];
                                    case 1:
                                        newWorkout = (_a.sent())[0];
                                        if (!newWorkout) {
                                            throw new Error('Failed to create duplicate workout');
                                        }
                                        if (!(originalExercises.length > 0)) return [3 /*break*/, 3];
                                        return [4 /*yield*/, tx.insert(schema_1.WorkoutExercise)
                                                .values(originalExercises.map(function (ex) { return ({
                                                workoutId: newWorkout.id,
                                                exerciseId: ex.exerciseId,
                                                orderIndex: ex.orderIndex,
                                                setsCompleted: ex.setsCompleted,
                                                groupName: ex.groupName,
                                            }); }))];
                                    case 2:
                                        _a.sent();
                                        _a.label = 3;
                                    case 3: return [2 /*return*/, newWorkout];
                                }
                            });
                        }); })];
                case 5:
                    result = _c.sent();
                    return [2 /*return*/, {
                            success: true,
                            workoutId: result.id
                        }];
            }
        });
    }); }),
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10;
