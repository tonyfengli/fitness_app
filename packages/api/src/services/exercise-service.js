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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExerciseService = void 0;
var server_1 = require("@trpc/server");
var db_1 = require("@acme/db");
var schema_1 = require("@acme/db/schema");
var ExerciseService = /** @class */ (function () {
    function ExerciseService(db) {
        this.db = db;
    }
    /**
     * Verify that a user has a businessId
     */
    ExerciseService.prototype.verifyUserHasBusiness = function (currentUser) {
        if (!currentUser.businessId) {
            throw new server_1.TRPCError({
                code: 'BAD_REQUEST',
                message: 'User must be associated with a business',
            });
        }
        return currentUser.businessId;
    };
    /**
     * Get exercises available to a business
     */
    ExerciseService.prototype.getBusinessExercises = function (businessId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db
                            .select({
                            exercise: schema_1.exercises,
                        })
                            .from(schema_1.exercises)
                            .innerJoin(schema_1.BusinessExercise, (0, db_1.eq)(schema_1.exercises.id, schema_1.BusinessExercise.exerciseId))
                            .where((0, db_1.eq)(schema_1.BusinessExercise.businessId, businessId))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Search exercises by name for a business
     */
    ExerciseService.prototype.searchBusinessExercises = function (businessId, searchTerm) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db
                            .select({
                            exercise: schema_1.exercises,
                        })
                            .from(schema_1.exercises)
                            .innerJoin(schema_1.BusinessExercise, (0, db_1.eq)(schema_1.exercises.id, schema_1.BusinessExercise.exerciseId))
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.BusinessExercise.businessId, businessId), (0, db_1.ilike)(schema_1.exercises.name, "%".concat(searchTerm, "%"))))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Verify that an exercise is available to a business
     */
    ExerciseService.prototype.verifyExerciseAccess = function (exerciseId, businessId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db
                            .select({
                            exercise: schema_1.exercises,
                        })
                            .from(schema_1.exercises)
                            .innerJoin(schema_1.BusinessExercise, (0, db_1.eq)(schema_1.exercises.id, schema_1.BusinessExercise.exerciseId))
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.exercises.id, exerciseId), (0, db_1.eq)(schema_1.BusinessExercise.businessId, businessId)))
                            .limit(1)];
                    case 1:
                        result = _a.sent();
                        if (!result[0]) {
                            throw new server_1.TRPCError({
                                code: 'NOT_FOUND',
                                message: 'Exercise not found or not available for your business',
                            });
                        }
                        return [2 /*return*/, result[0].exercise];
                }
            });
        });
    };
    /**
     * Create exercise name lookup map for matching
     */
    ExerciseService.prototype.createExerciseNameMap = function (businessExercises) {
        var exerciseByName = new Map();
        businessExercises.forEach(function (_a) {
            var exercise = _a.exercise;
            // Add exact name
            exerciseByName.set(exercise.name.toLowerCase(), exercise);
            // Add name without parentheses
            var nameWithoutParens = exercise.name.replace(/\s*\([^)]*\)/g, '').trim();
            if (nameWithoutParens !== exercise.name) {
                exerciseByName.set(nameWithoutParens.toLowerCase(), exercise);
            }
        });
        return exerciseByName;
    };
    /**
     * Filter exercises for workout generation
     */
    ExerciseService.prototype.filterForWorkoutGeneration = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var clientId, businessId, filterParams, client, clientContext, businessExercises, allExercises;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        clientId = params.clientId, businessId = params.businessId, filterParams = __rest(params, ["clientId", "businessId"]);
                        return [4 /*yield*/, this.db
                                .select()
                                .from(schema_1.user)
                                .where((0, db_1.eq)(schema_1.user.id, clientId))
                                .limit(1)
                                .then(function (res) { return res[0]; })];
                    case 1:
                        client = _a.sent();
                        if (!client || client.businessId !== businessId) {
                            throw new server_1.TRPCError({
                                code: 'NOT_FOUND',
                                message: 'Client not found in your business',
                            });
                        }
                        clientContext = {
                            user_id: clientId,
                            name: client.name || client.email || "Client",
                            strength_capacity: "moderate", // Default for now
                            skill_capacity: "moderate", // Default for now
                            primary_goal: filterParams.sessionGoal === "strength" ? "gain_strength" : "improve_stability",
                            muscle_target: filterParams.muscleTarget,
                            muscle_lessen: filterParams.muscleLessen,
                            exercise_requests: {
                                include: filterParams.includeExercises,
                                avoid: filterParams.avoidExercises,
                            },
                            avoid_joints: filterParams.avoidJoints,
                            business_id: businessId,
                            templateType: filterParams.template,
                        };
                        return [4 /*yield*/, this.getBusinessExercises(businessId)];
                    case 2:
                        businessExercises = _a.sent();
                        allExercises = businessExercises.map(function (be) { return be.exercise; });
                        // Return data needed for filtering
                        return [2 /*return*/, {
                                clientContext: clientContext,
                                exercises: allExercises,
                                intensity: filterParams.intensity,
                                template: filterParams.template,
                                debug: filterParams.debug,
                            }];
                }
            });
        });
    };
    /**
     * Standard error messages
     */
    ExerciseService.ERRORS = {
        NO_BUSINESS: 'User must be associated with a business',
        EXERCISE_NOT_FOUND: 'Exercise not found or not available for your business',
        INVALID_FILTER: 'Invalid filter parameters',
    };
    return ExerciseService;
}());
exports.ExerciseService = ExerciseService;
