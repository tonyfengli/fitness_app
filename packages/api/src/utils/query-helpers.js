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
exports.getWorkoutsWithExercisesOptimized = getWorkoutsWithExercisesOptimized;
exports.withPerformanceMonitoring = withPerformanceMonitoring;
var db_1 = require("@acme/db");
var schema_1 = require("@acme/db/schema");
var logger_1 = require("./logger");
var logger = (0, logger_1.createLogger)('QueryHelpers');
/**
 * Get workouts with exercises in a single optimized query
 * This prevents N+1 query problems by fetching all data at once
 */
function getWorkoutsWithExercisesOptimized(db, filters) {
    return __awaiter(this, void 0, void 0, function () {
        var workoutQuery, workouts, workoutIds, allExercises, exercisesByWorkout;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    workoutQuery = db
                        .select({
                        id: schema_1.Workout.id,
                        createdAt: schema_1.Workout.createdAt,
                        completedAt: schema_1.Workout.completedAt,
                        notes: schema_1.Workout.notes,
                        workoutType: schema_1.Workout.workoutType,
                        context: schema_1.Workout.context,
                        llmOutput: schema_1.Workout.llmOutput,
                    })
                        .from(schema_1.Workout)
                        .where((0, db_1.and)(filters.userId ? (0, db_1.eq)(schema_1.Workout.userId, filters.userId) : undefined, (0, db_1.eq)(schema_1.Workout.businessId, filters.businessId)))
                        .orderBy((0, db_1.desc)(schema_1.Workout.createdAt));
                    if (filters.limit) {
                        workoutQuery.limit(filters.limit);
                    }
                    return [4 /*yield*/, workoutQuery];
                case 1:
                    workouts = _a.sent();
                    if (workouts.length === 0) {
                        return [2 /*return*/, []];
                    }
                    workoutIds = workouts.map(function (w) { return w.id; });
                    return [4 /*yield*/, db
                            .select({
                            workoutExerciseId: schema_1.WorkoutExercise.id,
                            workoutId: schema_1.WorkoutExercise.workoutId,
                            orderIndex: schema_1.WorkoutExercise.orderIndex,
                            setsCompleted: schema_1.WorkoutExercise.setsCompleted,
                            groupName: schema_1.WorkoutExercise.groupName,
                            exerciseId: schema_1.exercises.id,
                            exerciseName: schema_1.exercises.name,
                            primaryMuscle: schema_1.exercises.primaryMuscle,
                        })
                            .from(schema_1.WorkoutExercise)
                            .innerJoin(schema_1.exercises, (0, db_1.eq)(schema_1.WorkoutExercise.exerciseId, schema_1.exercises.id))
                            .where((0, db_1.inArray)(schema_1.WorkoutExercise.workoutId, workoutIds))
                            .orderBy(schema_1.WorkoutExercise.orderIndex)];
                case 2:
                    allExercises = _a.sent();
                    exercisesByWorkout = allExercises.reduce(function (acc, row) {
                        if (!acc[row.workoutId]) {
                            acc[row.workoutId] = [];
                        }
                        acc[row.workoutId].push({
                            workoutExerciseId: row.workoutExerciseId,
                            orderIndex: row.orderIndex,
                            setsCompleted: row.setsCompleted,
                            groupName: row.groupName,
                            exercise: {
                                id: row.exerciseId,
                                name: row.exerciseName,
                                primaryMuscle: row.primaryMuscle,
                            },
                        });
                        return acc;
                    }, {});
                    // Step 4: Transform to final format
                    return [2 /*return*/, workouts.map(function (workout) {
                            var workoutExercises = exercisesByWorkout[workout.id] || [];
                            // Initialize blocks based on workout type and llmOutput
                            var initialBlocks = {};
                            // Determine expected blocks based on workout type or llmOutput
                            if (workout.llmOutput && typeof workout.llmOutput === 'object') {
                                // Extract block names from llmOutput (e.g., blockA, blockB, blockC, round1, round2, etc.)
                                Object.keys(workout.llmOutput).forEach(function (key) {
                                    if (key.startsWith('block') || key.startsWith('round')) {
                                        // Convert blockA -> Block A, round1 -> Round 1
                                        var blockName = key.startsWith('block')
                                            ? "Block ".concat(key.replace('block', '').toUpperCase())
                                            : "Round ".concat(key.replace('round', ''));
                                        initialBlocks[blockName] = [];
                                    }
                                });
                            }
                            else if (workout.workoutType === 'circuit') {
                                // Default circuit blocks
                                initialBlocks['Round 1'] = [];
                                initialBlocks['Round 2'] = [];
                                initialBlocks['Round 3'] = [];
                            }
                            else {
                                // Default standard/full_body blocks
                                initialBlocks['Block A'] = [];
                                initialBlocks['Block B'] = [];
                                initialBlocks['Block C'] = [];
                            }
                            // Group actual exercises by block
                            var exerciseBlocks = workoutExercises.reduce(function (acc, we) {
                                var blockName = we.groupName || 'Block A';
                                if (!acc[blockName]) {
                                    acc[blockName] = [];
                                }
                                acc[blockName].push({
                                    id: we.workoutExerciseId, // Use workoutExerciseId as the primary ID for UI operations
                                    exerciseId: we.exercise.id, // Keep the actual exercise ID for reference
                                    name: we.exercise.name,
                                    sets: we.setsCompleted,
                                });
                                return acc;
                            }, initialBlocks);
                            return __assign(__assign({}, workout), { exerciseBlocks: Object.entries(exerciseBlocks)
                                    .sort(function (a, b) { return a[0].localeCompare(b[0]); }) // Sort blocks alphabetically
                                    .map(function (_a) {
                                    var blockName = _a[0], exercises = _a[1];
                                    return ({
                                        blockName: blockName,
                                        exercises: exercises,
                                    });
                                }) });
                        })];
            }
        });
    });
}
/**
 * Performance monitoring wrapper for database queries
 */
function withPerformanceMonitoring(operation, fn) {
    return __awaiter(this, void 0, void 0, function () {
        var start, result, duration, error_1, duration;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    start = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fn()];
                case 2:
                    result = _a.sent();
                    duration = Date.now() - start;
                    // Log performance metrics (can be sent to monitoring service)
                    if (duration > 1000) {
                        logger.performance(operation, duration);
                    }
                    return [2 /*return*/, result];
                case 3:
                    error_1 = _a.sent();
                    duration = Date.now() - start;
                    logger.error("Query failed: ".concat(operation, " after ").concat(duration, "ms"), error_1);
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
