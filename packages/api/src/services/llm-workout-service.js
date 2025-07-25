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
exports.LLMWorkoutService = void 0;
var schema_1 = require("@acme/db/schema");
var ai_1 = require("@acme/ai");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.createLogger)('LLMWorkoutService');
var LLMWorkoutService = /** @class */ (function () {
    function LLMWorkoutService(db) {
        this.db = db;
    }
    /**
     * Create exercise lookup map from all exercises
     */
    LLMWorkoutService.prototype.createExerciseLookup = function () {
        return __awaiter(this, void 0, void 0, function () {
            var allExercises;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db.query.exercises.findMany()];
                    case 1:
                        allExercises = _a.sent();
                        if (!allExercises) {
                            logger.warn('No exercises found in database');
                            return [2 /*return*/, new Map()];
                        }
                        return [2 /*return*/, new Map(allExercises.map(function (ex) { return [ex.id, ex]; }))];
                }
            });
        });
    };
    /**
     * Save individual workout (no training session)
     */
    LLMWorkoutService.prototype.saveIndividualWorkout = function (input, clientName) {
        return __awaiter(this, void 0, void 0, function () {
            var exerciseLookup, transformed, result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.createExerciseLookup()];
                    case 1:
                        exerciseLookup = _a.sent();
                        // Validate exercises in LLM output
                        this.validateLLMOutput(input.llmOutput, exerciseLookup);
                        return [4 /*yield*/, this.transformOutput(input.llmOutput, exerciseLookup, input.templateType, input.workoutName, input.workoutDescription, clientName)];
                    case 2:
                        transformed = _a.sent();
                        return [4 /*yield*/, this.db.transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                var workout, exerciseData;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, tx
                                                .insert(schema_1.Workout)
                                                .values({
                                                userId: input.userId,
                                                businessId: input.businessId,
                                                createdByTrainerId: input.createdByTrainerId,
                                                notes: transformed.workout.description,
                                                workoutType: transformed.workout.workoutType,
                                                totalPlannedSets: transformed.workout.totalPlannedSets,
                                                llmOutput: transformed.workout.llmOutput,
                                                templateConfig: transformed.workout.templateConfig,
                                                context: input.context || "individual",
                                                // No trainingSessionId for individual workouts
                                            })
                                                .returning()];
                                        case 1:
                                            workout = (_a.sent())[0];
                                            if (!workout) {
                                                throw new Error('Failed to create workout');
                                            }
                                            if (!(transformed.exercises.length > 0)) return [3 /*break*/, 3];
                                            exerciseData = this.createExerciseRecords(workout.id, transformed.exercises);
                                            if (!(exerciseData.length > 0)) return [3 /*break*/, 3];
                                            return [4 /*yield*/, tx.insert(schema_1.WorkoutExercise).values(exerciseData)];
                                        case 2:
                                            _a.sent();
                                            _a.label = 3;
                                        case 3: return [2 /*return*/, workout];
                                    }
                                });
                            }); })];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Validate LLM output exercises against database
     */
    LLMWorkoutService.prototype.validateLLMOutput = function (llmOutput, exerciseLookup) {
        var validation = (0, ai_1.validateExerciseLookup)(llmOutput, exerciseLookup);
        if (!validation.valid) {
            logger.warn('Some exercises not found', validation.warnings);
        }
        return validation;
    };
    /**
     * Transform LLM output to database format
     */
    LLMWorkoutService.prototype.transformOutput = function (llmOutput, exerciseLookup, workoutType, workoutName, workoutDescription, clientName) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, ai_1.transformLLMOutputToDB)(llmOutput, exerciseLookup, workoutType || 'standard', workoutName, workoutDescription || "Generated by AI for ".concat(clientName || 'client'))];
                    case 1:
                        result = _a.sent();
                        // Ensure description and templateConfig are always defined
                        return [2 /*return*/, {
                                workout: __assign(__assign({}, result.workout), { description: result.workout.description || "Generated by AI for ".concat(clientName || 'client'), templateConfig: result.workout.templateConfig || {} }),
                                exercises: result.exercises
                            }];
                }
            });
        });
    };
    /**
     * Create workout record
     */
    LLMWorkoutService.prototype.createWorkoutRecord = function (input, transformed) {
        return {
            trainingSessionId: input.trainingSessionId,
            userId: input.userId,
            businessId: input.businessId,
            createdByTrainerId: input.createdByTrainerId,
            completedAt: new Date(), // LLM-generated workouts are marked as completed
            notes: transformed.workout.description,
            workoutType: transformed.workout.workoutType,
            totalPlannedSets: transformed.workout.totalPlannedSets,
            llmOutput: transformed.workout.llmOutput,
            templateConfig: transformed.workout.templateConfig,
            context: "group", // Has training session
        };
    };
    /**
     * Create workout exercise records
     */
    LLMWorkoutService.prototype.createExerciseRecords = function (workoutId, transformedExercises) {
        return transformedExercises
            .filter(function (ex) { return ex.exerciseId !== 'unknown'; }) // Skip unknown exercises
            .map(function (ex) { return ({
            workoutId: workoutId,
            exerciseId: ex.exerciseId,
            orderIndex: ex.orderIndex,
            setsCompleted: ex.sets,
            groupName: ex.groupName,
            // Store additional info in notes for now
            notes: [
                ex.reps && "Reps: ".concat(ex.reps),
                ex.restPeriod && "Rest: ".concat(ex.restPeriod),
                ex.notes
            ].filter(Boolean).join(' | ') || undefined,
        }); });
    };
    /**
     * Save LLM-generated workout with exercises
     */
    LLMWorkoutService.prototype.saveWorkout = function (input, clientName) {
        return __awaiter(this, void 0, void 0, function () {
            var exerciseLookup, transformed, result;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.createExerciseLookup()];
                    case 1:
                        exerciseLookup = _a.sent();
                        // Validate exercises in LLM output
                        this.validateLLMOutput(input.llmOutput, exerciseLookup);
                        return [4 /*yield*/, this.transformOutput(input.llmOutput, exerciseLookup, input.workoutType || 'standard', input.workoutName, input.workoutDescription, clientName)];
                    case 2:
                        transformed = _a.sent();
                        return [4 /*yield*/, this.db.transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                var workout, exerciseData;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, tx
                                                .insert(schema_1.Workout)
                                                .values(this.createWorkoutRecord(input, transformed))
                                                .returning()];
                                        case 1:
                                            workout = (_a.sent())[0];
                                            if (!workout) {
                                                throw new Error('Failed to create workout');
                                            }
                                            if (!(transformed.exercises.length > 0)) return [3 /*break*/, 3];
                                            exerciseData = this.createExerciseRecords(workout.id, transformed.exercises);
                                            if (!(exerciseData.length > 0)) return [3 /*break*/, 3];
                                            return [4 /*yield*/, tx.insert(schema_1.WorkoutExercise).values(exerciseData)];
                                        case 2:
                                            _a.sent();
                                            _a.label = 3;
                                        case 3: return [2 /*return*/, workout];
                                    }
                                });
                            }); })];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    return LLMWorkoutService;
}());
exports.LLMWorkoutService = LLMWorkoutService;
