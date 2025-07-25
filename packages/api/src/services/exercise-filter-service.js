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
exports.ExerciseFilterService = void 0;
var server_1 = require("@trpc/server");
var db_1 = require("@acme/db");
var schema_1 = require("@acme/db/schema");
var ai_1 = require("@acme/ai");
var ExerciseFilterService = /** @class */ (function () {
    function ExerciseFilterService(db) {
        this.db = db;
    }
    /**
     * Apply equipment filters to exercises
     */
    ExerciseFilterService.prototype.applyEquipmentFilters = function (exercises, equipment) {
        if (!equipment || equipment.length === 0) {
            return exercises;
        }
        return exercises.filter(function (exercise) {
            var exerciseEquipment = exercise.equipment || [];
            return equipment.some(function (eq) { return exerciseEquipment.includes(eq); });
        });
    };
    /**
     * Apply muscle group filters to exercises
     */
    ExerciseFilterService.prototype.applyMuscleGroupFilters = function (exercises, muscleGroups) {
        if (!muscleGroups || muscleGroups.length === 0) {
            return exercises;
        }
        return exercises.filter(function (exercise) {
            var primaryMuscle = exercise.primaryMuscle;
            var secondaryMuscles = exercise.secondaryMuscles || [];
            return muscleGroups.some(function (muscle) {
                return primaryMuscle === muscle || secondaryMuscles.includes(muscle);
            });
        });
    };
    /**
     * Apply movement pattern filters to exercises
     */
    ExerciseFilterService.prototype.applyMovementPatternFilters = function (exercises, patterns) {
        if (!patterns || patterns.length === 0) {
            return exercises;
        }
        return exercises.filter(function (exercise) {
            var movementPattern = exercise.movementPattern;
            return patterns.includes(movementPattern);
        });
    };
    /**
     * Apply difficulty filters based on skill capacity
     */
    ExerciseFilterService.prototype.applyDifficultyFilters = function (exercises, skillCapacity) {
        var difficultyMap = {
            very_low: ["very_easy", "easy"],
            low: ["very_easy", "easy", "moderate"],
            moderate: ["easy", "moderate", "hard"],
            high: ["moderate", "hard", "very_hard"]
        };
        var allowedDifficulties = difficultyMap[skillCapacity] || difficultyMap.moderate;
        return exercises.filter(function (exercise) {
            var complexity = exercise.complexityLevel || "moderate";
            return allowedDifficulties.includes(complexity);
        });
    };
    /**
     * Fetch exercises available to the business
     */
    ExerciseFilterService.prototype.fetchBusinessExercises = function (businessId) {
        return __awaiter(this, void 0, void 0, function () {
            var businessExercises;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db
                            .select({
                            exercise: schema_1.exercises,
                        })
                            .from(schema_1.exercises)
                            .innerJoin(schema_1.BusinessExercise, (0, db_1.eq)(schema_1.exercises.id, schema_1.BusinessExercise.exerciseId))
                            .where((0, db_1.eq)(schema_1.BusinessExercise.businessId, businessId))];
                    case 1:
                        businessExercises = _a.sent();
                        return [2 /*return*/, businessExercises.map(function (be) { return be.exercise; })];
                }
            });
        });
    };
    /**
     * Prepare input with defaults
     */
    ExerciseFilterService.prototype.prepareInput = function (input) {
        return {
            clientName: (input === null || input === void 0 ? void 0 : input.clientName) || "Default Client",
            strengthCapacity: (input === null || input === void 0 ? void 0 : input.strengthCapacity) || "moderate",
            skillCapacity: (input === null || input === void 0 ? void 0 : input.skillCapacity) || "moderate",
            includeExercises: (input === null || input === void 0 ? void 0 : input.includeExercises) || [],
            avoidExercises: (input === null || input === void 0 ? void 0 : input.avoidExercises) || [],
            avoidJoints: (input === null || input === void 0 ? void 0 : input.avoidJoints) || [],
            muscleTarget: (input === null || input === void 0 ? void 0 : input.muscleTarget) || [],
            muscleLessen: (input === null || input === void 0 ? void 0 : input.muscleLessen) || [],
            primaryGoal: input === null || input === void 0 ? void 0 : input.primaryGoal,
            intensity: input === null || input === void 0 ? void 0 : input.intensity,
            isFullBody: (input === null || input === void 0 ? void 0 : input.isFullBody) || false,
            userInput: input === null || input === void 0 ? void 0 : input.userInput,
            debug: (input === null || input === void 0 ? void 0 : input.debug) || false
        };
    };
    /**
     * Main filter method - orchestrates the filtering process
     */
    ExerciseFilterService.prototype.filterExercises = function (input, context) {
        return __awaiter(this, void 0, void 0, function () {
            var apiStartTime, safeInput, dbStartTime, allExercises, dbEndTime, filterFunction, filterStartTime, result, filterEndTime, filteredExercises, apiEndTime, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        apiStartTime = Date.now();
                        safeInput = this.prepareInput(input);
                        dbStartTime = Date.now();
                        return [4 /*yield*/, this.fetchBusinessExercises(context.businessId)];
                    case 1:
                        allExercises = _a.sent();
                        dbEndTime = Date.now();
                        filterFunction = safeInput.debug
                            ? ai_1.enhancedFilterExercisesFromInput
                            : ai_1.filterExercisesFromInput;
                        filterStartTime = Date.now();
                        return [4 /*yield*/, filterFunction({
                                clientContext: {
                                    user_id: context.userId,
                                    name: safeInput.clientName,
                                    strength_capacity: safeInput.strengthCapacity,
                                    skill_capacity: safeInput.skillCapacity,
                                    primary_goal: safeInput.primaryGoal,
                                    muscle_target: safeInput.muscleTarget,
                                    muscle_lessen: safeInput.muscleLessen,
                                    exercise_requests: {
                                        include: safeInput.includeExercises,
                                        avoid: safeInput.avoidExercises,
                                    },
                                    avoid_joints: safeInput.avoidJoints,
                                    business_id: context.businessId,
                                    templateType: input === null || input === void 0 ? void 0 : input.template // Add for backward compatibility
                                },
                                userInput: safeInput.userInput,
                                exercises: allExercises,
                                intensity: safeInput.intensity,
                                enableDebug: safeInput.debug,
                                workoutTemplate: {
                                    workout_goal: safeInput.isFullBody ? "mixed_focus" : "mixed_focus",
                                    muscle_target: safeInput.muscleTarget,
                                    isFullBody: safeInput.isFullBody
                                },
                            })];
                    case 2:
                        result = _a.sent();
                        filterEndTime = Date.now();
                        filteredExercises = result.filteredExercises || [];
                        if (!safeInput.debug) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.saveDebugData(safeInput, filteredExercises)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        apiEndTime = Date.now();
                        // Log performance metrics
                        if (process.env.NODE_ENV !== 'production') {
                            console.log("[ExerciseFilter] Performance: DB=".concat(dbEndTime - dbStartTime, "ms, Filter=").concat(filterEndTime - filterStartTime, "ms, Total=").concat(apiEndTime - apiStartTime, "ms"));
                        }
                        return [2 /*return*/, {
                                exercises: filteredExercises,
                                timing: {
                                    database: dbEndTime - dbStartTime,
                                    filtering: filterEndTime - filterStartTime
                                }
                            }];
                    case 5:
                        error_1 = _a.sent();
                        console.error('❌ Exercise filtering failed:', error_1);
                        if (error_1 instanceof server_1.TRPCError) {
                            throw error_1;
                        }
                        throw new server_1.TRPCError({
                            code: 'INTERNAL_SERVER_ERROR',
                            message: 'Failed to filter exercises',
                            cause: error_1
                        });
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Save debug data for analysis
     */
    ExerciseFilterService.prototype.saveDebugData = function (input, filteredExercises) {
        return __awaiter(this, void 0, void 0, function () {
            var blockA, blockB, blockC, blockD;
            return __generator(this, function (_a) {
                try {
                    blockA = filteredExercises.filter(function (ex) { return ex.isSelectedBlockA; });
                    blockB = filteredExercises.filter(function (ex) { return ex.isSelectedBlockB; });
                    blockC = filteredExercises.filter(function (ex) { return ex.isSelectedBlockC; });
                    blockD = filteredExercises.filter(function (ex) { return ex.isSelectedBlockD; });
                    (0, ai_1.saveFilterDebugData)({
                        timestamp: new Date().toISOString(),
                        filters: {
                            clientName: input.clientName,
                            strengthCapacity: input.strengthCapacity,
                            skillCapacity: input.skillCapacity,
                            intensity: input.intensity || 'moderate',
                            muscleTarget: input.muscleTarget,
                            muscleLessen: input.muscleLessen,
                            avoidJoints: input.avoidJoints,
                            includeExercises: input.includeExercises,
                            avoidExercises: input.avoidExercises,
                            sessionGoal: input.primaryGoal,
                            isFullBody: input.isFullBody
                        },
                        results: {
                            totalExercises: filteredExercises.length,
                            blockA: this.formatBlockDebugData(blockA, 5),
                            blockB: this.formatBlockDebugData(blockB, 3),
                            blockC: this.formatBlockDebugData(blockC, 3),
                            blockD: this.formatBlockDebugData(blockD, 4)
                        }
                    });
                }
                catch (debugError) {
                    console.error('Failed to save debug data:', debugError);
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Format block data for debug output
     */
    ExerciseFilterService.prototype.formatBlockDebugData = function (exercises, limit) {
        return {
            count: exercises.length,
            exercises: exercises.slice(0, limit).map(function (ex) { return ({
                id: ex.id,
                name: ex.name,
                score: ex.score || 0
            }); })
        };
    };
    /**
     * Filter exercises for workout generation
     * This is a specialized version that includes client validation and block organization
     */
    ExerciseFilterService.prototype.filterForWorkoutGeneration = function (input, context) {
        return __awaiter(this, void 0, void 0, function () {
            var apiStartTime, client, userProfile, clientProfile, primaryGoal, filterInput, filterResult, filteredExercises, blockA, blockB, blockC, blockD, apiEndTime;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        apiStartTime = Date.now();
                        return [4 /*yield*/, this.db
                                .select()
                                .from(schema_1.user)
                                .where((0, db_1.eq)(schema_1.user.id, input.clientId))
                                .limit(1)
                                .then(function (res) { return res[0]; })];
                    case 1:
                        client = _c.sent();
                        if (!client || client.businessId !== context.businessId) {
                            throw new server_1.TRPCError({
                                code: 'NOT_FOUND',
                                message: 'Client not found in your business',
                            });
                        }
                        return [4 /*yield*/, this.db.query.UserProfile.findFirst({
                                where: (0, db_1.and)((0, db_1.eq)(schema_1.UserProfile.userId, input.clientId), (0, db_1.eq)(schema_1.UserProfile.businessId, context.businessId)),
                            })];
                    case 2:
                        userProfile = _c.sent();
                        clientProfile = {
                            strengthCapacity: ((userProfile === null || userProfile === void 0 ? void 0 : userProfile.strengthLevel) || "moderate"),
                            skillCapacity: ((userProfile === null || userProfile === void 0 ? void 0 : userProfile.skillLevel) || "moderate"),
                        };
                        primaryGoal = input.sessionGoal === "strength" ? "strength" : "mobility";
                        filterInput = {
                            clientId: input.clientId,
                            clientName: client.name || client.email || "Client",
                            strengthCapacity: clientProfile.strengthCapacity,
                            skillCapacity: clientProfile.skillCapacity,
                            primaryGoal: primaryGoal,
                            intensity: input.intensity,
                            muscleTarget: input.muscleTarget,
                            muscleLessen: input.muscleLessen,
                            includeExercises: input.includeExercises,
                            avoidExercises: input.avoidExercises,
                            avoidJoints: input.avoidJoints,
                            isFullBody: input.template === "full_body",
                            debug: input.debug,
                            template: input.template // Pass template for backward compatibility
                        };
                        return [4 /*yield*/, this.filterExercises(filterInput, __assign(__assign({}, context), { userId: input.clientId // Use clientId for workout generation
                             }))];
                    case 3:
                        filterResult = _c.sent();
                        filteredExercises = filterResult.exercises;
                        blockA = filteredExercises.filter(function (ex) { return ex.isSelectedBlockA; });
                        blockB = filteredExercises.filter(function (ex) { return ex.isSelectedBlockB; });
                        blockC = filteredExercises.filter(function (ex) { return ex.isSelectedBlockC; });
                        blockD = filteredExercises.filter(function (ex) { return ex.isSelectedBlockD; });
                        apiEndTime = Date.now();
                        // Log timing
                        console.log('=== WORKOUT GENERATION FILTER TIMING ===');
                        console.log("Total API Time: ".concat(apiEndTime - apiStartTime, "ms"));
                        console.log("Total exercises found: ".concat(filteredExercises.length));
                        console.log('==========================================');
                        if (input.debug) {
                            console.log('Block A exercises:', blockA.length);
                            console.log('Block B exercises:', blockB.length);
                            console.log('Block C exercises:', blockC.length);
                            console.log('Block D exercises:', blockD.length);
                        }
                        return [2 /*return*/, {
                                exercises: filteredExercises,
                                blocks: {
                                    blockA: blockA,
                                    blockB: blockB,
                                    blockC: blockC,
                                    blockD: blockD,
                                },
                                timing: {
                                    database: ((_a = filterResult.timing) === null || _a === void 0 ? void 0 : _a.database) || 0,
                                    filtering: ((_b = filterResult.timing) === null || _b === void 0 ? void 0 : _b.filtering) || 0,
                                    total: apiEndTime - apiStartTime,
                                }
                            }];
                }
            });
        });
    };
    return ExerciseFilterService;
}());
exports.ExerciseFilterService = ExerciseFilterService;
