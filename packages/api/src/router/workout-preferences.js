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
exports.workoutPreferencesRouter = void 0;
var zod_1 = require("zod");
var trpc_1 = require("../trpc");
var client_1 = require("@acme/db/client");
var schema_1 = require("@acme/db/schema");
var db_1 = require("@acme/db");
var server_1 = require("@trpc/server");
exports.workoutPreferencesRouter = (0, trpc_1.createTRPCRouter)({
    create: trpc_1.protectedProcedure
        .input(schema_1.CreateWorkoutPreferencesSchema)
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var checkIn, preference;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, client_1.db
                        .select()
                        .from(schema_1.UserTrainingSession)
                        .where((0, db_1.and)((0, db_1.eq)(schema_1.UserTrainingSession.userId, input.userId), (0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, input.trainingSessionId), (0, db_1.eq)(schema_1.UserTrainingSession.status, "checked_in")))
                        .limit(1)];
                case 1:
                    checkIn = _c.sent();
                    if (!checkIn.length) {
                        throw new server_1.TRPCError({
                            code: "FORBIDDEN",
                            message: "User must be checked in to submit preferences",
                        });
                    }
                    return [4 /*yield*/, client_1.db
                            .insert(schema_1.WorkoutPreferences)
                            .values(input)
                            .returning()];
                case 2:
                    preference = (_c.sent())[0];
                    // Update check-in to mark preferences as collected
                    return [4 /*yield*/, client_1.db
                            .update(schema_1.UserTrainingSession)
                            .set({ preferenceCollectionStep: "initial_collected" })
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.UserTrainingSession.userId, input.userId), (0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, input.trainingSessionId)))];
                case 3:
                    // Update check-in to mark preferences as collected
                    _c.sent();
                    return [2 /*return*/, preference];
            }
        });
    }); }),
    update: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        id: zod_1.z.string().uuid(),
        intensity: zod_1.z.enum(["low", "moderate", "high"]).optional(),
        muscleTargets: zod_1.z.array(zod_1.z.string()).optional(),
        muscleLessens: zod_1.z.array(zod_1.z.string()).optional(),
        includeExercises: zod_1.z.array(zod_1.z.string()).optional(),
        avoidExercises: zod_1.z.array(zod_1.z.string()).optional(),
        avoidJoints: zod_1.z.array(zod_1.z.string()).optional(),
        sessionGoal: zod_1.z.string().optional(),
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var id, updates, updated;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    id = input.id, updates = __rest(input, ["id"]);
                    return [4 /*yield*/, client_1.db
                            .update(schema_1.WorkoutPreferences)
                            .set(updates)
                            .where((0, db_1.eq)(schema_1.WorkoutPreferences.id, id))
                            .returning()];
                case 1:
                    updated = (_c.sent())[0];
                    if (!updated) {
                        throw new server_1.TRPCError({
                            code: "NOT_FOUND",
                            message: "Preferences not found",
                        });
                    }
                    return [2 /*return*/, updated];
            }
        });
    }); }),
    getBySession: trpc_1.protectedProcedure
        .input(zod_1.z.object({ sessionId: zod_1.z.string().uuid() }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var preferences;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, client_1.db
                        .select()
                        .from(schema_1.WorkoutPreferences)
                        .where((0, db_1.eq)(schema_1.WorkoutPreferences.trainingSessionId, input.sessionId))
                        .orderBy((0, db_1.desc)(schema_1.WorkoutPreferences.collectedAt))];
                case 1:
                    preferences = _c.sent();
                    return [2 /*return*/, preferences];
            }
        });
    }); }),
    getByUser: trpc_1.protectedProcedure
        .input(zod_1.z.object({ userId: zod_1.z.string() }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var preferences;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, client_1.db
                        .select()
                        .from(schema_1.WorkoutPreferences)
                        .where((0, db_1.eq)(schema_1.WorkoutPreferences.userId, input.userId))
                        .orderBy((0, db_1.desc)(schema_1.WorkoutPreferences.collectedAt))
                        .limit(10)];
                case 1:
                    preferences = _c.sent();
                    return [2 /*return*/, preferences];
            }
        });
    }); }),
    getForUserSession: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        userId: zod_1.z.string(),
        sessionId: zod_1.z.string().uuid()
    }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var preference;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, client_1.db
                        .select()
                        .from(schema_1.WorkoutPreferences)
                        .where((0, db_1.and)((0, db_1.eq)(schema_1.WorkoutPreferences.userId, input.userId), (0, db_1.eq)(schema_1.WorkoutPreferences.trainingSessionId, input.sessionId)))
                        .limit(1)];
                case 1:
                    preference = (_c.sent())[0];
                    return [2 /*return*/, preference || null];
            }
        });
    }); }),
});
