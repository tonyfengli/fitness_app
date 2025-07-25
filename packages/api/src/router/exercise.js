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
exports.exerciseRouter = void 0;
var server_1 = require("@trpc/server");
var v4_1 = require("zod/v4");
var db_1 = require("@acme/db");
var schema_1 = require("@acme/db/schema");
var trpc_1 = require("../trpc");
var exercise_service_1 = require("../services/exercise-service");
var exercise_filter_service_1 = require("../services/exercise-filter-service");
var CreateExerciseSchema = v4_1.z.object({
    name: v4_1.z.string().min(1).max(255),
    primaryMuscle: v4_1.z.enum([
        "glutes", "quads", "hamstrings", "calves", "adductors", "abductors",
        "core", "lower_abs", "upper_abs", "obliques", "chest", "upper_chest",
        "lower_chest", "lats", "traps", "biceps", "triceps", "shoulders",
        "delts", "upper_back", "lower_back", "shins", "tibialis_anterior"
    ]),
    secondaryMuscles: v4_1.z.array(v4_1.z.enum([
        "glutes", "quads", "hamstrings", "calves", "adductors", "abductors",
        "core", "lower_abs", "upper_abs", "obliques", "chest", "upper_chest",
        "lower_chest", "lats", "traps", "biceps", "triceps", "shoulders",
        "delts", "upper_back", "lower_back", "shins", "tibialis_anterior"
    ])).optional(),
    loadedJoints: v4_1.z.array(v4_1.z.enum([
        "ankles", "knees", "hips", "shoulders", "elbows", "wrists",
        "neck", "lower_back", "spine", "sacroiliac_joint", "patella", "rotator_cuff"
    ])).optional(),
    movementPattern: v4_1.z.enum([
        "horizontal_push", "horizontal_pull", "vertical_push", "vertical_pull",
        "shoulder_isolation", "arm_isolation", "leg_isolation", "squat",
        "lunge", "hinge", "carry", "core"
    ]),
    modality: v4_1.z.enum([
        "strength", "stability", "core", "power", "conditioning", "mobility"
    ]),
    movementTags: v4_1.z.array(v4_1.z.enum([
        "bilateral", "unilateral", "scapular_control", "core_stability",
        "postural_control", "hip_dominant", "knee_dominant", "balance_challenge",
        "isometric_control", "anti_rotation", "end_range_control", "hip_stability",
        "explosive", "rotational", "cross_plane",
        "foundational", "rehab_friendly", "warmup_friendly", "finisher_friendly", "mobility_focus"
    ])).optional(),
    functionTags: v4_1.z.array(v4_1.z.enum([
        "primary_strength", "secondary_strength", "accessory", "core", "capacity"
    ])).optional(),
    fatigueProfile: v4_1.z.enum([
        "low_local", "moderate_local", "high_local", "moderate_systemic", "high_systemic", "metabolic"
    ]),
    complexityLevel: v4_1.z.enum(["very_low", "low", "moderate", "high"]),
    equipment: v4_1.z.array(v4_1.z.enum([
        "barbell", "dumbbells", "bench", "landmine", "trx", "kettlebell",
        "cable_machine", "bands", "bosu_ball", "swiss_ball", "platform",
        "pull_up_bar", "back_machine", "ab_wheel", "box", "med_ball"
    ])).optional(),
    strengthLevel: v4_1.z.enum(["very_low", "low", "moderate", "high"]),
});
var UpdateExerciseSchema = CreateExerciseSchema.partial();
exports.exerciseRouter = {
    all: trpc_1.publicProcedure
        .input(v4_1.z.object({
        limit: v4_1.z.number().min(1).max(1000).default(20),
        offset: v4_1.z.number().min(0).default(0),
    }).optional())
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var _c, _d, limit, _e, offset, user, businessId, businessExercises, result, result;
        var _f;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    _c = input !== null && input !== void 0 ? input : {}, _d = _c.limit, limit = _d === void 0 ? 20 : _d, _e = _c.offset, offset = _e === void 0 ? 0 : _e;
                    user = (_f = ctx.session) === null || _f === void 0 ? void 0 : _f.user;
                    businessId = user === null || user === void 0 ? void 0 : user.businessId;
                    if (!businessId) return [3 /*break*/, 2];
                    return [4 /*yield*/, ctx.db
                            .select({
                            exercise: schema_1.exercises,
                        })
                            .from(schema_1.exercises)
                            .innerJoin(schema_1.BusinessExercise, (0, db_1.eq)(schema_1.exercises.id, schema_1.BusinessExercise.exerciseId))
                            .where((0, db_1.eq)(schema_1.BusinessExercise.businessId, businessId))
                            .orderBy((0, db_1.desc)(schema_1.exercises.createdAt))
                            .limit(limit)
                            .offset(offset)];
                case 1:
                    businessExercises = _g.sent();
                    result = businessExercises.map(function (be) { return be.exercise; });
                    return [2 /*return*/, result];
                case 2: return [4 /*yield*/, ctx.db.query.exercises.findMany({
                        orderBy: (0, db_1.desc)(schema_1.exercises.createdAt),
                        limit: limit,
                        offset: offset,
                    })];
                case 3:
                    result = _g.sent();
                    return [2 /*return*/, result];
            }
        });
    }); }),
    byId: trpc_1.publicProcedure
        .input(v4_1.z.object({ id: v4_1.z.string().uuid() }))
        .query(function (_a) {
        var ctx = _a.ctx, input = _a.input;
        return ctx.db.query.exercises.findFirst({
            where: (0, db_1.eq)(schema_1.exercises.id, input.id),
        });
    }),
    search: trpc_1.publicProcedure
        .input(v4_1.z.object({
        query: v4_1.z.string().optional(),
        primaryMuscle: v4_1.z.string().optional(),
        movementPattern: v4_1.z.string().optional(),
        modality: v4_1.z.string().optional(),
        equipment: v4_1.z.array(v4_1.z.string()).optional(),
        limit: v4_1.z.number().min(1).max(100).default(20),
    }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var conditions, whereClause, user, businessId, results;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    conditions = [];
                    if (input.query) {
                        conditions.push((0, db_1.ilike)(schema_1.exercises.name, "%".concat(input.query, "%")));
                    }
                    if (input.primaryMuscle) {
                        conditions.push((0, db_1.eq)(schema_1.exercises.primaryMuscle, input.primaryMuscle));
                    }
                    if (input.movementPattern) {
                        conditions.push((0, db_1.eq)(schema_1.exercises.movementPattern, input.movementPattern));
                    }
                    if (input.modality) {
                        conditions.push((0, db_1.eq)(schema_1.exercises.modality, input.modality));
                    }
                    whereClause = conditions.length > 0 ? db_1.and.apply(void 0, conditions) : undefined;
                    user = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    businessId = user === null || user === void 0 ? void 0 : user.businessId;
                    if (!businessId) return [3 /*break*/, 2];
                    return [4 /*yield*/, ctx.db
                            .select({
                            exercise: schema_1.exercises,
                        })
                            .from(schema_1.exercises)
                            .innerJoin(schema_1.BusinessExercise, (0, db_1.eq)(schema_1.exercises.id, schema_1.BusinessExercise.exerciseId))
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.BusinessExercise.businessId, businessId), whereClause))
                            .orderBy((0, db_1.desc)(schema_1.exercises.createdAt))
                            .limit(input.limit)];
                case 1:
                    results = _d.sent();
                    return [2 /*return*/, results.map(function (r) { return r.exercise; })];
                case 2: 
                // No business context - search all exercises
                return [2 /*return*/, ctx.db.query.exercises.findMany({
                        where: whereClause,
                        orderBy: (0, db_1.desc)(schema_1.exercises.createdAt),
                        limit: input.limit,
                    })];
            }
        });
    }); }),
    filter: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        // Client identification
        clientId: v4_1.z.string().optional(), // User ID of the client
        // Client fitness profile
        clientName: v4_1.z.string().default("Default Client"),
        strengthCapacity: v4_1.z.enum(["very_low", "low", "moderate", "high"]).default("moderate"),
        skillCapacity: v4_1.z.enum(["very_low", "low", "moderate", "high"]).default("moderate"),
        // Exercise inclusion/exclusion
        includeExercises: v4_1.z.array(v4_1.z.string()).default([]),
        avoidExercises: v4_1.z.array(v4_1.z.string()).default([]),
        // Joint restrictions (for injuries/limitations)
        avoidJoints: v4_1.z.array(v4_1.z.string()).default([]),
        // Phase 2 Client fields
        primaryGoal: v4_1.z.enum(["mobility", "strength", "general_fitness", "hypertrophy", "burn_fat"]).optional(),
        intensity: v4_1.z.enum(["low", "moderate", "high"]).optional(),
        muscleTarget: v4_1.z.array(v4_1.z.string()).default([]),
        muscleLessen: v4_1.z.array(v4_1.z.string()).default([]),
        // Template selection
        isFullBody: v4_1.z.boolean().default(false),
        // Business context - removed, will use from session
        // Optional user input for future LLM processing
        userInput: v4_1.z.string().optional(),
        // Enable enhanced debug mode
        debug: v4_1.z.boolean().optional(),
    }).optional())
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, exerciseService, businessId, filterService, result, error_1;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 2, , 3]);
                    user = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    exerciseService = new exercise_service_1.ExerciseService(ctx.db);
                    businessId = exerciseService.verifyUserHasBusiness(user);
                    filterService = new exercise_filter_service_1.ExerciseFilterService(ctx.db);
                    return [4 /*yield*/, filterService.filterExercises(input, {
                            userId: user.id,
                            businessId: businessId
                        })];
                case 1:
                    result = _d.sent();
                    return [2 /*return*/, result.exercises];
                case 2:
                    error_1 = _d.sent();
                    if (error_1 instanceof server_1.TRPCError) {
                        throw error_1;
                    }
                    throw new Error('Failed to filter exercises');
                case 3: return [2 /*return*/];
            }
        });
    }); }),
    create: trpc_1.protectedProcedure
        .input(CreateExerciseSchema)
        .mutation(function (_a) {
        var ctx = _a.ctx, input = _a.input;
        return ctx.db.insert(schema_1.exercises).values(input).returning();
    }),
    update: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        id: v4_1.z.string().uuid(),
        data: UpdateExerciseSchema,
    }))
        .mutation(function (_a) {
        var ctx = _a.ctx, input = _a.input;
        return ctx.db
            .update(schema_1.exercises)
            .set(input.data)
            .where((0, db_1.eq)(schema_1.exercises.id, input.id))
            .returning();
    }),
    delete: trpc_1.protectedProcedure
        .input(v4_1.z.string().uuid())
        .mutation(function (_a) {
        var ctx = _a.ctx, input = _a.input;
        return ctx.db.delete(schema_1.exercises).where((0, db_1.eq)(schema_1.exercises.id, input));
    }),
    // Filter exercises for workout generation modal
    filterForWorkoutGeneration: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        clientId: v4_1.z.string(),
        sessionGoal: v4_1.z.enum(["strength", "stability"]),
        intensity: v4_1.z.enum(["low", "moderate", "high"]),
        template: v4_1.z.enum(["standard", "circuit", "full_body"]),
        includeExercises: v4_1.z.array(v4_1.z.string()),
        avoidExercises: v4_1.z.array(v4_1.z.string()),
        muscleTarget: v4_1.z.array(v4_1.z.string()),
        muscleLessen: v4_1.z.array(v4_1.z.string()),
        avoidJoints: v4_1.z.array(v4_1.z.string()),
        debug: v4_1.z.boolean().optional(),
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var sessionUser, exerciseService, businessId, filterService;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            sessionUser = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
            exerciseService = new exercise_service_1.ExerciseService(ctx.db);
            businessId = exerciseService.verifyUserHasBusiness(sessionUser);
            filterService = new exercise_filter_service_1.ExerciseFilterService(ctx.db);
            return [2 /*return*/, filterService.filterForWorkoutGeneration(input, {
                    userId: sessionUser.id,
                    businessId: businessId
                })];
        });
    }); }),
};
