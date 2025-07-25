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
exports.trainingSessionRouter = void 0;
var v4_1 = require("zod/v4");
var server_1 = require("@trpc/server");
var db_1 = require("@acme/db");
var schema_1 = require("@acme/db/schema");
var ai_1 = require("@acme/ai");
var trpc_1 = require("../trpc");
// Helper function to calculate score distribution
function calculateScoreDistribution(exercises) {
    var ranges = [
        { range: '0-2', min: 0, max: 2, count: 0 },
        { range: '2-4', min: 2, max: 4, count: 0 },
        { range: '4-6', min: 4, max: 6, count: 0 },
        { range: '6-8', min: 6, max: 8, count: 0 },
        { range: '8+', min: 8, max: Infinity, count: 0 }
    ];
    for (var _i = 0, exercises_1 = exercises; _i < exercises_1.length; _i++) {
        var exercise = exercises_1[_i];
        var score = exercise.score || 0;
        for (var _a = 0, ranges_1 = ranges; _a < ranges_1.length; _a++) {
            var range = ranges_1[_a];
            if (score >= range.min && score < range.max) {
                range.count++;
                break;
            }
        }
    }
    return ranges.map(function (r) { return ({ range: r.range, count: r.count }); });
}
// Helper to get equipment needs from exercise name
function getEquipmentFromExercise(exerciseName) {
    var name = exerciseName.toLowerCase();
    var equipment = [];
    // Barbells
    if (name.includes('barbell') && !name.includes('dumbbell')) {
        equipment.push('barbell');
    }
    // Benches
    if (name.includes('bench') || name.includes('incline')) {
        equipment.push('bench');
    }
    // Dumbbells
    if (name.includes('dumbbell') || name.includes('db ')) {
        equipment.push('DB');
    }
    // Kettlebells
    if (name.includes('kettlebell') || name.includes('goblet')) {
        equipment.push('KB');
    }
    // Cable
    if (name.includes('cable') || name.includes('lat pulldown')) {
        equipment.push('cable');
    }
    // Bands
    if (name.includes('band')) {
        equipment.push('band');
    }
    // Landmine
    if (name.includes('landmine')) {
        equipment.push('landmine');
    }
    // Medicine ball
    if (name.includes('medicine ball') || name.includes('med ball')) {
        equipment.push('med ball');
    }
    // Row machine
    if (name.includes('row machine')) {
        equipment.push('row machine');
    }
    // Floor exercises
    if (name.includes('plank') || name.includes('dead bug') || name.includes('bird dog') ||
        name.includes('bear crawl') || name.includes('push-up')) {
        equipment.push('none');
    }
    // Swiss ball
    if (name.includes('swiss ball') || name.includes('stability ball')) {
        equipment.push('swiss ball');
    }
    return equipment.length > 0 ? equipment : ['none'];
}
exports.trainingSessionRouter = {
    // Create a new training session (trainers only)
    create: trpc_1.protectedProcedure
        .input(schema_1.CreateTrainingSessionSchema)
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, existingOpenSession, session;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    user = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    // Only trainers can create training sessions
                    if (user.role !== 'trainer') {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'Only trainers can create training sessions',
                        });
                    }
                    // Ensure trainer creates sessions for their own business
                    if (input.businessId !== user.businessId) {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'You can only create sessions for your own business',
                        });
                    }
                    return [4 /*yield*/, ctx.db.query.TrainingSession.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.TrainingSession.businessId, user.businessId), (0, db_1.eq)(schema_1.TrainingSession.status, 'open')),
                        })];
                case 1:
                    existingOpenSession = _d.sent();
                    if (existingOpenSession) {
                        throw new server_1.TRPCError({
                            code: 'CONFLICT',
                            message: 'There is already an open session for this business. Please close it before creating a new one.',
                        });
                    }
                    return [4 /*yield*/, ctx.db
                            .insert(schema_1.TrainingSession)
                            .values(__assign(__assign({}, input), { trainerId: user.id, status: 'open' }))
                            .returning()];
                case 2:
                    session = (_d.sent())[0];
                    return [2 /*return*/, session];
            }
        });
    }); }),
    // List all sessions (filtered by business)
    list: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        limit: v4_1.z.number().min(1).max(100).default(20),
        offset: v4_1.z.number().min(0).default(0),
        // Optional filters
        trainerId: v4_1.z.string().optional(),
        startDate: v4_1.z.date().optional(),
        endDate: v4_1.z.date().optional(),
    }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, conditions, sessions;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    user = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    conditions = [(0, db_1.eq)(schema_1.TrainingSession.businessId, user.businessId)];
                    if (input.trainerId) {
                        conditions.push((0, db_1.eq)(schema_1.TrainingSession.trainerId, input.trainerId));
                    }
                    if (input.startDate) {
                        conditions.push((0, db_1.gte)(schema_1.TrainingSession.scheduledAt, input.startDate));
                    }
                    if (input.endDate) {
                        conditions.push((0, db_1.lte)(schema_1.TrainingSession.scheduledAt, input.endDate));
                    }
                    return [4 /*yield*/, ctx.db
                            .select()
                            .from(schema_1.TrainingSession)
                            .where(db_1.and.apply(void 0, conditions))
                            .orderBy((0, db_1.desc)(schema_1.TrainingSession.scheduledAt))
                            .limit(input.limit)
                            .offset(input.offset)];
                case 1:
                    sessions = _d.sent();
                    return [2 /*return*/, sessions];
            }
        });
    }); }),
    // Get checked-in clients for a session
    getCheckedInClients: trpc_1.protectedProcedure
        .input(v4_1.z.object({ sessionId: v4_1.z.string().uuid() }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, session, checkedInUsers, usersWithDetails;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    user = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    return [4 /*yield*/, ctx.db.query.TrainingSession.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.TrainingSession.id, input.sessionId), (0, db_1.eq)(schema_1.TrainingSession.businessId, user.businessId)),
                        })];
                case 1:
                    session = _d.sent();
                    if (!session) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Session not found',
                        });
                    }
                    return [4 /*yield*/, ctx.db
                            .select()
                            .from(schema_1.UserTrainingSession)
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, input.sessionId), (0, db_1.eq)(schema_1.UserTrainingSession.status, 'checked_in')))
                            .orderBy((0, db_1.desc)(schema_1.UserTrainingSession.checkedInAt))];
                case 2:
                    checkedInUsers = _d.sent();
                    return [4 /*yield*/, Promise.all(checkedInUsers.map(function (checkin) { return __awaiter(void 0, void 0, void 0, function () {
                            var userInfo, preferences;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, ctx.db.query.user.findFirst({
                                            where: (0, db_1.eq)(schema_1.user.id, checkin.userId)
                                        })];
                                    case 1:
                                        userInfo = _a.sent();
                                        return [4 /*yield*/, ctx.db
                                                .select()
                                                .from(schema_1.WorkoutPreferences)
                                                .where((0, db_1.and)((0, db_1.eq)(schema_1.WorkoutPreferences.userId, checkin.userId), (0, db_1.eq)(schema_1.WorkoutPreferences.trainingSessionId, input.sessionId)))
                                                .limit(1)];
                                    case 2:
                                        preferences = (_a.sent())[0];
                                        return [2 /*return*/, {
                                                userId: checkin.userId,
                                                checkedInAt: checkin.checkedInAt,
                                                userName: (userInfo === null || userInfo === void 0 ? void 0 : userInfo.name) || null,
                                                userEmail: (userInfo === null || userInfo === void 0 ? void 0 : userInfo.email) || "",
                                                preferenceCollectionStep: checkin.preferenceCollectionStep,
                                                preferences: preferences ? {
                                                    intensity: preferences.intensity,
                                                    muscleTargets: preferences.muscleTargets,
                                                    muscleLessens: preferences.muscleLessens,
                                                    includeExercises: preferences.includeExercises,
                                                    avoidExercises: preferences.avoidExercises,
                                                    avoidJoints: preferences.avoidJoints,
                                                    sessionGoal: preferences.sessionGoal
                                                } : null
                                            }];
                                }
                            });
                        }); }))];
                case 3:
                    usersWithDetails = _d.sent();
                    return [2 /*return*/, usersWithDetails];
            }
        });
    }); }),
    // Get session by ID with participants
    getById: trpc_1.protectedProcedure
        .input(v4_1.z.object({ id: v4_1.z.string().uuid() }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, session, participants;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    user = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    return [4 /*yield*/, ctx.db.query.TrainingSession.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.TrainingSession.id, input.id), (0, db_1.eq)(schema_1.TrainingSession.businessId, user.businessId)),
                        })];
                case 1:
                    session = _d.sent();
                    if (!session) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Training session not found',
                        });
                    }
                    return [4 /*yield*/, ctx.db
                            .select({
                            userId: schema_1.UserTrainingSession.userId,
                            joinedAt: schema_1.UserTrainingSession.createdAt,
                        })
                            .from(schema_1.UserTrainingSession)
                            .where((0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, input.id))];
                case 2:
                    participants = _d.sent();
                    return [2 /*return*/, __assign(__assign({}, session), { participants: participants })];
            }
        });
    }); }),
    // Add participant to session
    addParticipant: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        sessionId: v4_1.z.string().uuid(),
        userId: v4_1.z.string().optional(), // If not provided, add current user
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, targetUserId, session, existing, currentCount, registration;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    user = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    targetUserId = input.userId || user.id;
                    return [4 /*yield*/, ctx.db.query.TrainingSession.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.TrainingSession.id, input.sessionId), (0, db_1.eq)(schema_1.TrainingSession.businessId, user.businessId)),
                        })];
                case 1:
                    session = _d.sent();
                    if (!session) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Training session not found',
                        });
                    }
                    return [4 /*yield*/, ctx.db.query.UserTrainingSession.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.UserTrainingSession.userId, targetUserId), (0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, input.sessionId)),
                        })];
                case 2:
                    existing = _d.sent();
                    if (existing) {
                        throw new server_1.TRPCError({
                            code: 'CONFLICT',
                            message: 'User already registered for this session',
                        });
                    }
                    if (!session.maxParticipants) return [3 /*break*/, 4];
                    return [4 /*yield*/, ctx.db
                            .select({ count: schema_1.UserTrainingSession.id })
                            .from(schema_1.UserTrainingSession)
                            .where((0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, input.sessionId))];
                case 3:
                    currentCount = _d.sent();
                    if (currentCount.length >= session.maxParticipants) {
                        throw new server_1.TRPCError({
                            code: 'CONFLICT',
                            message: 'Session is full',
                        });
                    }
                    _d.label = 4;
                case 4: return [4 /*yield*/, ctx.db
                        .insert(schema_1.UserTrainingSession)
                        .values({
                        userId: targetUserId,
                        trainingSessionId: input.sessionId,
                    })
                        .returning()];
                case 5:
                    registration = (_d.sent())[0];
                    return [2 /*return*/, registration];
            }
        });
    }); }),
    // Remove participant from session
    removeParticipant: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        sessionId: v4_1.z.string().uuid(),
        userId: v4_1.z.string().optional(), // If not provided, remove current user
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, targetUserId;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    user = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    targetUserId = input.userId || user.id;
                    // Only trainers can remove other users
                    if (input.userId && input.userId !== user.id && user.role !== 'trainer') {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'Only trainers can remove other participants',
                        });
                    }
                    return [4 /*yield*/, ctx.db
                            .delete(schema_1.UserTrainingSession)
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.UserTrainingSession.userId, targetUserId), (0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, input.sessionId)))];
                case 1:
                    _d.sent();
                    return [2 /*return*/, { success: true }];
            }
        });
    }); }),
    // Get past sessions for current user
    myPast: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        limit: v4_1.z.number().min(1).max(100).default(20),
        offset: v4_1.z.number().min(0).default(0),
    }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, now, sessions;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    user = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    now = new Date();
                    return [4 /*yield*/, ctx.db
                            .select({
                            session: schema_1.TrainingSession,
                        })
                            .from(schema_1.TrainingSession)
                            .innerJoin(schema_1.UserTrainingSession, (0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, schema_1.TrainingSession.id))
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.UserTrainingSession.userId, user.id), (0, db_1.eq)(schema_1.TrainingSession.businessId, user.businessId), (0, db_1.lte)(schema_1.TrainingSession.scheduledAt, now)))
                            .orderBy((0, db_1.desc)(schema_1.TrainingSession.scheduledAt))
                            .limit(input.limit)
                            .offset(input.offset)];
                case 1:
                    sessions = _d.sent();
                    return [2 /*return*/, sessions.map(function (s) { return s.session; })];
            }
        });
    }); }),
    // Start a session (open -> in_progress)
    startSession: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        sessionId: v4_1.z.string().uuid()
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, session, updatedSession;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    user = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    // Only trainers can start sessions
                    if (user.role !== 'trainer') {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'Only trainers can start sessions',
                        });
                    }
                    return [4 /*yield*/, ctx.db.query.TrainingSession.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.TrainingSession.id, input.sessionId), (0, db_1.eq)(schema_1.TrainingSession.businessId, user.businessId)),
                        })];
                case 1:
                    session = _d.sent();
                    if (!session) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Session not found',
                        });
                    }
                    // Validate current status
                    if (session.status !== 'open') {
                        throw new server_1.TRPCError({
                            code: 'BAD_REQUEST',
                            message: "Cannot start session. Current status is ".concat(session.status, ". Session must be 'open' to start."),
                        });
                    }
                    return [4 /*yield*/, ctx.db
                            .update(schema_1.TrainingSession)
                            .set({ status: 'in_progress' })
                            .where((0, db_1.eq)(schema_1.TrainingSession.id, input.sessionId))
                            .returning()];
                case 2:
                    updatedSession = (_d.sent())[0];
                    return [2 /*return*/, updatedSession];
            }
        });
    }); }),
    // Complete a session (in_progress -> completed)
    completeSession: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        sessionId: v4_1.z.string().uuid()
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, session, updatedSession;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    user = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    // Only trainers can complete sessions
                    if (user.role !== 'trainer') {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'Only trainers can complete sessions',
                        });
                    }
                    return [4 /*yield*/, ctx.db.query.TrainingSession.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.TrainingSession.id, input.sessionId), (0, db_1.eq)(schema_1.TrainingSession.businessId, user.businessId)),
                        })];
                case 1:
                    session = _d.sent();
                    if (!session) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Session not found',
                        });
                    }
                    // Validate current status
                    if (session.status !== 'in_progress') {
                        throw new server_1.TRPCError({
                            code: 'BAD_REQUEST',
                            message: "Cannot complete session. Current status is ".concat(session.status, ". Session must be 'in_progress' to complete."),
                        });
                    }
                    return [4 /*yield*/, ctx.db
                            .update(schema_1.TrainingSession)
                            .set({ status: 'completed' })
                            .where((0, db_1.eq)(schema_1.TrainingSession.id, input.sessionId))
                            .returning()];
                case 2:
                    updatedSession = (_d.sent())[0];
                    return [2 /*return*/, updatedSession];
            }
        });
    }); }),
    // Cancel a session (open -> cancelled)
    cancelSession: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        sessionId: v4_1.z.string().uuid()
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, session, updatedSession;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    user = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    // Only trainers can cancel sessions
                    if (user.role !== 'trainer') {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'Only trainers can cancel sessions',
                        });
                    }
                    return [4 /*yield*/, ctx.db.query.TrainingSession.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.TrainingSession.id, input.sessionId), (0, db_1.eq)(schema_1.TrainingSession.businessId, user.businessId)),
                        })];
                case 1:
                    session = _d.sent();
                    if (!session) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Session not found',
                        });
                    }
                    // Validate current status - can only cancel open sessions
                    if (session.status !== 'open') {
                        throw new server_1.TRPCError({
                            code: 'BAD_REQUEST',
                            message: "Cannot cancel session. Current status is ".concat(session.status, ". Only 'open' sessions can be cancelled."),
                        });
                    }
                    return [4 /*yield*/, ctx.db
                            .update(schema_1.TrainingSession)
                            .set({ status: 'cancelled' })
                            .where((0, db_1.eq)(schema_1.TrainingSession.id, input.sessionId))
                            .returning()];
                case 2:
                    updatedSession = (_d.sent())[0];
                    return [2 /*return*/, updatedSession];
            }
        });
    }); }),
    // Delete a session and all associated data
    deleteSession: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        sessionId: v4_1.z.string().uuid()
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, session;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    user = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    // Only trainers can delete sessions
                    if (user.role !== 'trainer') {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'Only trainers can delete sessions',
                        });
                    }
                    return [4 /*yield*/, ctx.db.query.TrainingSession.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.TrainingSession.id, input.sessionId), (0, db_1.eq)(schema_1.TrainingSession.businessId, user.businessId)),
                        })];
                case 1:
                    session = _d.sent();
                    if (!session) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Session not found',
                        });
                    }
                    // Delete in the correct order to respect foreign key constraints
                    // 1. Delete workout preferences
                    return [4 /*yield*/, ctx.db
                            .delete(schema_1.WorkoutPreferences)
                            .where((0, db_1.eq)(schema_1.WorkoutPreferences.trainingSessionId, input.sessionId))];
                case 2:
                    // Delete in the correct order to respect foreign key constraints
                    // 1. Delete workout preferences
                    _d.sent();
                    // 2. Delete user training sessions (registrations/check-ins)
                    return [4 /*yield*/, ctx.db
                            .delete(schema_1.UserTrainingSession)
                            .where((0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, input.sessionId))];
                case 3:
                    // 2. Delete user training sessions (registrations/check-ins)
                    _d.sent();
                    // 3. Finally delete the training session
                    return [4 /*yield*/, ctx.db
                            .delete(schema_1.TrainingSession)
                            .where((0, db_1.eq)(schema_1.TrainingSession.id, input.sessionId))];
                case 4:
                    // 3. Finally delete the training session
                    _d.sent();
                    return [2 /*return*/, { success: true, deletedSessionId: input.sessionId }];
            }
        });
    }); }),
    // Add test clients to session (development only)
    addTestClients: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        sessionId: v4_1.z.string().uuid()
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, session, existingCheckIns, checkedInUserIds, whereConditions, availableClients, addedClients, availableExercises, muscleGroupsSet, muscleOptions, exerciseNames, intensityOptions, jointOptions, goalOptions, _loop_1, _i, availableClients_1, client;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    user = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    // Only trainers can add test clients
                    if (user.role !== 'trainer') {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'Only trainers can add test clients',
                        });
                    }
                    return [4 /*yield*/, ctx.db.query.TrainingSession.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.TrainingSession.id, input.sessionId), (0, db_1.eq)(schema_1.TrainingSession.businessId, user.businessId), (0, db_1.eq)(schema_1.TrainingSession.status, 'open')),
                        })];
                case 1:
                    session = _d.sent();
                    if (!session) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Open session not found',
                        });
                    }
                    return [4 /*yield*/, ctx.db
                            .select({ userId: schema_1.UserTrainingSession.userId })
                            .from(schema_1.UserTrainingSession)
                            .where((0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, input.sessionId))];
                case 2:
                    existingCheckIns = _d.sent();
                    checkedInUserIds = existingCheckIns.map(function (c) { return c.userId; });
                    whereConditions = [
                        (0, db_1.eq)(schema_1.user.businessId, user.businessId),
                        (0, db_1.eq)(schema_1.user.role, 'client')
                    ];
                    if (checkedInUserIds.length > 0) {
                        whereConditions.push((0, db_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["", " NOT IN (", ")"], ["", " NOT IN (", ")"])), schema_1.user.id, db_1.sql.join(checkedInUserIds.map(function (id) { return (0, db_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["", ""], ["", ""])), id); }), (0, db_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject([", "], [", "]))))));
                    }
                    return [4 /*yield*/, ctx.db
                            .select()
                            .from(schema_1.user)
                            .where(db_1.and.apply(void 0, whereConditions))
                            .limit(3)];
                case 3:
                    availableClients = _d.sent();
                    if (availableClients.length === 0) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'No available clients found to add to the session',
                        });
                    }
                    addedClients = [];
                    return [4 /*yield*/, ctx.db
                            .select({
                            id: schema_1.exercises.id,
                            name: schema_1.exercises.name,
                            primaryMuscle: schema_1.exercises.primaryMuscle,
                            secondaryMuscles: schema_1.exercises.secondaryMuscles,
                        })
                            .from(schema_1.exercises)
                            .limit(50)];
                case 4:
                    availableExercises = _d.sent();
                    if (availableExercises.length === 0) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'No exercises found for this business. Please seed exercises first.',
                        });
                    }
                    muscleGroupsSet = new Set();
                    availableExercises.forEach(function (exercise) {
                        // Add primary muscle
                        if (exercise.primaryMuscle) {
                            muscleGroupsSet.add(exercise.primaryMuscle.toLowerCase());
                        }
                        // Add secondary muscles
                        if (exercise.secondaryMuscles && Array.isArray(exercise.secondaryMuscles)) {
                            exercise.secondaryMuscles.forEach(function (muscle) {
                                if (muscle) {
                                    muscleGroupsSet.add(muscle.toLowerCase());
                                }
                            });
                        }
                    });
                    muscleOptions = Array.from(muscleGroupsSet);
                    // If no muscle groups found, use defaults
                    if (muscleOptions.length === 0) {
                        muscleOptions = ['chest', 'back', 'shoulders', 'legs', 'core'];
                    }
                    exerciseNames = availableExercises
                        .map(function (e) { return e.name; })
                        .filter(function (name) { return name && name.length > 0; });
                    intensityOptions = ['low', 'moderate', 'high'];
                    jointOptions = ['knees', 'shoulders', 'lower back', 'wrists', 'ankles', 'elbows', 'hips'];
                    goalOptions = ['strength', 'mobility', 'general_fitness'];
                    _loop_1 = function (client) {
                        var randomIntensity, randomGoal, randomMuscleTargets_1, otherMuscles, muscle, numMuscleTargets, i, muscle, randomMuscleLessens, availableMusclesForLessen, lessenMuscle, randomAvoidJoints, joint, randomIncludeExercises_1, includeExercise, randomAvoidExercises, availableExercisesForAvoid, avoidExercise, preferenceValues, error_1;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    _e.trys.push([0, 3, , 4]);
                                    return [4 /*yield*/, ctx.db
                                            .insert(schema_1.UserTrainingSession)
                                            .values({
                                            userId: client.id,
                                            trainingSessionId: input.sessionId,
                                            status: 'checked_in',
                                            checkedInAt: new Date(),
                                            preferenceCollectionStep: 'ACTIVE',
                                        })];
                                case 1:
                                    _e.sent();
                                    randomIntensity = intensityOptions[Math.floor(Math.random() * intensityOptions.length)];
                                    randomGoal = goalOptions[Math.floor(Math.random() * goalOptions.length)];
                                    randomMuscleTargets_1 = [];
                                    if (addedClients.length === 0 && muscleOptions.includes('upper_back')) {
                                        // First client gets specific settings for testing
                                        randomIntensity = 'moderate'; // Force moderate intensity
                                        randomMuscleTargets_1.push('upper_back');
                                        // Maybe add a second muscle target (50% chance)
                                        if (Math.random() < 0.5) {
                                            otherMuscles = muscleOptions.filter(function (m) { return m !== 'upper_back' && m !== 'calves'; });
                                            if (otherMuscles.length > 0) {
                                                muscle = otherMuscles[Math.floor(Math.random() * otherMuscles.length)];
                                                if (muscle) {
                                                    randomMuscleTargets_1.push(muscle);
                                                }
                                            }
                                        }
                                    }
                                    else {
                                        numMuscleTargets = Math.floor(Math.random() * 2) + 1;
                                        for (i = 0; i < numMuscleTargets; i++) {
                                            muscle = muscleOptions[Math.floor(Math.random() * muscleOptions.length)];
                                            if (muscle && !randomMuscleTargets_1.includes(muscle)) {
                                                randomMuscleTargets_1.push(muscle);
                                            }
                                        }
                                    }
                                    randomMuscleLessens = [];
                                    if (addedClients.length === 0 && muscleOptions.includes('calves')) {
                                        // First client always gets calves as muscle lessen for testing
                                        randomMuscleLessens = ['calves'];
                                    }
                                    else if (Math.random() < 0.3 && muscleOptions.length > 0) {
                                        availableMusclesForLessen = muscleOptions.filter(function (m) { return !randomMuscleTargets_1.includes(m); });
                                        if (availableMusclesForLessen.length > 0) {
                                            lessenMuscle = availableMusclesForLessen[Math.floor(Math.random() * availableMusclesForLessen.length)];
                                            if (lessenMuscle) {
                                                randomMuscleLessens = [lessenMuscle];
                                            }
                                        }
                                    }
                                    randomAvoidJoints = [];
                                    if (Math.random() < 0.2 && jointOptions.length > 0) {
                                        joint = jointOptions[Math.floor(Math.random() * jointOptions.length)];
                                        if (joint) {
                                            randomAvoidJoints.push(joint);
                                        }
                                    }
                                    randomIncludeExercises_1 = [];
                                    if (Math.random() < 0.4 && exerciseNames.length > 0) {
                                        includeExercise = exerciseNames[Math.floor(Math.random() * exerciseNames.length)];
                                        if (includeExercise) {
                                            randomIncludeExercises_1.push(includeExercise);
                                        }
                                    }
                                    randomAvoidExercises = [];
                                    if (Math.random() < 0.3 && exerciseNames.length > 1) {
                                        availableExercisesForAvoid = exerciseNames.filter(function (e) { return !randomIncludeExercises_1.includes(e); });
                                        if (availableExercisesForAvoid.length > 0) {
                                            avoidExercise = availableExercisesForAvoid[Math.floor(Math.random() * availableExercisesForAvoid.length)];
                                            if (avoidExercise) {
                                                randomAvoidExercises = [avoidExercise];
                                            }
                                        }
                                    }
                                    preferenceValues = {
                                        userId: client.id,
                                        trainingSessionId: input.sessionId,
                                        businessId: user.businessId,
                                        intensity: randomIntensity,
                                        muscleTargets: randomMuscleTargets_1.length > 0 ? randomMuscleTargets_1 : undefined,
                                        muscleLessens: randomMuscleLessens.length > 0 ? randomMuscleLessens : undefined,
                                        includeExercises: randomIncludeExercises_1.length > 0 ? randomIncludeExercises_1 : undefined,
                                        avoidExercises: randomAvoidExercises.length > 0 ? randomAvoidExercises : undefined,
                                        avoidJoints: randomAvoidJoints.length > 0 ? randomAvoidJoints : undefined,
                                        sessionGoal: randomGoal,
                                        intensitySource: 'explicit',
                                        sessionGoalSource: 'explicit',
                                        collectionMethod: 'manual'
                                    };
                                    return [4 /*yield*/, ctx.db
                                            .insert(schema_1.WorkoutPreferences)
                                            .values(preferenceValues)];
                                case 2:
                                    _e.sent();
                                    addedClients.push({
                                        userId: client.id,
                                        name: client.name,
                                        email: client.email,
                                        checkedInAt: new Date(),
                                    });
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_1 = _e.sent();
                                    console.error('Error adding test client:', error_1);
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, availableClients_1 = availableClients;
                    _d.label = 5;
                case 5:
                    if (!(_i < availableClients_1.length)) return [3 /*break*/, 8];
                    client = availableClients_1[_i];
                    return [5 /*yield**/, _loop_1(client)];
                case 6:
                    _d.sent();
                    _d.label = 7;
                case 7:
                    _i++;
                    return [3 /*break*/, 5];
                case 8: return [2 /*return*/, {
                        success: true,
                        message: "Successfully added ".concat(addedClients.length, " clients"),
                        clients: addedClients,
                    }];
            }
        });
    }); }),
    // Visualize group workout phases A & B (for testing/development)
    visualizeGroupWorkout: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        sessionId: v4_1.z.string().uuid()
    }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, session, checkedInClients, clientsWithPreferences, ExerciseFilterService, groupWorkoutTestDataLogger, filterService, initialClientContexts, initialGroupContext, phase1_2StartTime, clientProcessingResults, phase1_2Time, clientContexts, preScoredExercises, allFilteredExercises, _i, clientProcessingResults_1, result, _c, _d, exercise, score, scoreBreakdown, cleanExercise, exercisePool, _loop_2, _e, preScoredExercises_1, _f, clientId, exercises_2, groupContext, blueprint, error_2;
        var _g, _h;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    console.log('🎯 visualizeGroupWorkout called with:', { sessionId: input.sessionId });
                    user = (_g = ctx.session) === null || _g === void 0 ? void 0 : _g.user;
                    // Only trainers can visualize group workouts
                    if (user.role !== 'trainer') {
                        console.error('❌ User is not a trainer:', user.role);
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'Only trainers can visualize group workouts',
                        });
                    }
                    return [4 /*yield*/, ctx.db.query.TrainingSession.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.TrainingSession.id, input.sessionId), (0, db_1.eq)(schema_1.TrainingSession.businessId, user.businessId)),
                        })];
                case 1:
                    session = _j.sent();
                    if (!session) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Session not found',
                        });
                    }
                    // Get checked-in clients with their preferences
                    console.log('📋 Fetching checked-in clients...');
                    return [4 /*yield*/, ctx.db
                            .select({
                            userId: schema_1.user.id,
                            userName: schema_1.user.name,
                            userEmail: schema_1.user.email,
                            checkedInAt: schema_1.UserTrainingSession.checkedInAt,
                            sessionUserId: schema_1.UserTrainingSession.id,
                        })
                            .from(schema_1.UserTrainingSession)
                            .innerJoin(schema_1.user, (0, db_1.eq)(schema_1.UserTrainingSession.userId, schema_1.user.id))
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, input.sessionId), (0, db_1.eq)(schema_1.UserTrainingSession.status, 'checked_in')))];
                case 2:
                    checkedInClients = _j.sent();
                    return [4 /*yield*/, Promise.all(checkedInClients.map(function (client) { return __awaiter(void 0, void 0, void 0, function () {
                            var preferences, userProfile;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, ctx.db
                                            .select()
                                            .from(schema_1.WorkoutPreferences)
                                            .where((0, db_1.and)((0, db_1.eq)(schema_1.WorkoutPreferences.userId, client.userId), (0, db_1.eq)(schema_1.WorkoutPreferences.trainingSessionId, input.sessionId)))
                                            .limit(1)];
                                    case 1:
                                        preferences = (_a.sent())[0];
                                        return [4 /*yield*/, ctx.db
                                                .select()
                                                .from(schema_1.UserProfile)
                                                .where((0, db_1.and)((0, db_1.eq)(schema_1.UserProfile.userId, client.userId), (0, db_1.eq)(schema_1.UserProfile.businessId, user.businessId)))
                                                .limit(1)];
                                    case 2:
                                        userProfile = (_a.sent())[0];
                                        return [2 /*return*/, __assign(__assign({}, client), { preferences: preferences, userProfile: userProfile })];
                                }
                            });
                        }); }))];
                case 3:
                    clientsWithPreferences = _j.sent();
                    console.log("\u2705 Found ".concat(clientsWithPreferences.length, " checked-in clients with preferences"));
                    if (clientsWithPreferences.length < 2) {
                        console.error('❌ Not enough clients:', clientsWithPreferences.length);
                        throw new server_1.TRPCError({
                            code: 'BAD_REQUEST',
                            message: 'Need at least 2 checked-in clients for group workout visualization',
                        });
                    }
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../services/exercise-filter-service"); })];
                case 4:
                    ExerciseFilterService = (_j.sent()).ExerciseFilterService;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../utils/groupWorkoutTestDataLogger"); })];
                case 5:
                    groupWorkoutTestDataLogger = (_j.sent()).groupWorkoutTestDataLogger;
                    filterService = new ExerciseFilterService(ctx.db);
                    initialClientContexts = clientsWithPreferences.map(function (client) {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
                        return ({
                            user_id: client.userId,
                            name: (_a = client.userName) !== null && _a !== void 0 ? _a : 'Unknown',
                            strength_capacity: ((_c = (_b = client.userProfile) === null || _b === void 0 ? void 0 : _b.strengthLevel) !== null && _c !== void 0 ? _c : 'moderate'),
                            skill_capacity: ((_e = (_d = client.userProfile) === null || _d === void 0 ? void 0 : _d.skillLevel) !== null && _e !== void 0 ? _e : 'moderate'),
                            primary_goal: ((_f = client.preferences) === null || _f === void 0 ? void 0 : _f.sessionGoal) === 'strength' ? 'strength' : 'general_fitness',
                            intensity: ((_h = (_g = client.preferences) === null || _g === void 0 ? void 0 : _g.intensity) !== null && _h !== void 0 ? _h : 'moderate'),
                            muscle_target: (_k = (_j = client.preferences) === null || _j === void 0 ? void 0 : _j.muscleTargets) !== null && _k !== void 0 ? _k : [],
                            muscle_lessen: (_m = (_l = client.preferences) === null || _l === void 0 ? void 0 : _l.muscleLessens) !== null && _m !== void 0 ? _m : [],
                            exercise_requests: {
                                include: (_p = (_o = client.preferences) === null || _o === void 0 ? void 0 : _o.includeExercises) !== null && _p !== void 0 ? _p : [],
                                avoid: (_r = (_q = client.preferences) === null || _q === void 0 ? void 0 : _q.avoidExercises) !== null && _r !== void 0 ? _r : []
                            },
                            avoid_joints: (_t = (_s = client.preferences) === null || _s === void 0 ? void 0 : _s.avoidJoints) !== null && _t !== void 0 ? _t : [],
                            business_id: user.businessId,
                            templateType: session.templateType,
                            default_sets: (_v = (_u = client.userProfile) === null || _u === void 0 ? void 0 : _u.defaultSets) !== null && _v !== void 0 ? _v : 20
                        });
                    });
                    initialGroupContext = {
                        clients: initialClientContexts,
                        sessionId: input.sessionId,
                        businessId: user.businessId,
                        templateType: session.templateType,
                    };
                    // Initialize test data logging
                    groupWorkoutTestDataLogger.initSession(input.sessionId, initialGroupContext);
                    console.log('💪 Running Phase 1 & 2 for each client...');
                    phase1_2StartTime = Date.now();
                    return [4 /*yield*/, Promise.all(clientsWithPreferences.map(function (client) { return __awaiter(void 0, void 0, void 0, function () {
                            var prefs, clientStartTime, userProfile, filterInput, filteredResult, clientProcessingTime, clientContext;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        prefs = client.preferences;
                                        clientStartTime = Date.now();
                                        return [4 /*yield*/, ctx.db.query.UserProfile.findFirst({
                                                where: (0, db_1.and)((0, db_1.eq)(schema_1.UserProfile.userId, client.userId), (0, db_1.eq)(schema_1.UserProfile.businessId, user.businessId)),
                                            })];
                                    case 1:
                                        userProfile = _a.sent();
                                        filterInput = {
                                            clientId: client.userId,
                                            clientName: client.userName || client.userEmail,
                                            strengthCapacity: ((userProfile === null || userProfile === void 0 ? void 0 : userProfile.strengthLevel) || 'moderate'),
                                            skillCapacity: ((userProfile === null || userProfile === void 0 ? void 0 : userProfile.skillLevel) || 'moderate'),
                                            sessionGoal: (prefs === null || prefs === void 0 ? void 0 : prefs.sessionGoal) || 'strength',
                                            intensity: (prefs === null || prefs === void 0 ? void 0 : prefs.intensity) || 'moderate',
                                            template: session.templateType === 'full_body_bmf' ? 'full_body' : 'standard', // Use appropriate template based on session
                                            includeExercises: (prefs === null || prefs === void 0 ? void 0 : prefs.includeExercises) || [],
                                            avoidExercises: (prefs === null || prefs === void 0 ? void 0 : prefs.avoidExercises) || [],
                                            muscleTarget: (prefs === null || prefs === void 0 ? void 0 : prefs.muscleTargets) || [],
                                            muscleLessen: (prefs === null || prefs === void 0 ? void 0 : prefs.muscleLessens) || [],
                                            avoidJoints: (prefs === null || prefs === void 0 ? void 0 : prefs.avoidJoints) || [],
                                            debug: true, // Enable debug for visibility
                                        };
                                        console.log("  \uD83D\uDCCB Processing client ".concat(client.userName || client.userId, "..."));
                                        console.log("    Strength: ".concat(filterInput.strengthCapacity, ", Skill: ").concat(filterInput.skillCapacity));
                                        return [4 /*yield*/, filterService.filterForWorkoutGeneration(filterInput, {
                                                userId: user.id, // Keep trainer ID for context
                                                businessId: user.businessId
                                            })];
                                    case 2:
                                        filteredResult = _a.sent();
                                        clientProcessingTime = Date.now() - clientStartTime;
                                        console.log("  \u2705 Client ".concat(client.userName, ": ").concat(filteredResult.exercises.length, " exercises filtered & scored"));
                                        // Log client processing data
                                        groupWorkoutTestDataLogger.logClientProcessing(input.sessionId, client.userId, {
                                            stats: {
                                                totalExercises: filteredResult.totalExercises || 1000,
                                                afterStrengthFilter: filteredResult.exercises.length,
                                                afterSkillFilter: filteredResult.exercises.length,
                                                afterJointFilter: filteredResult.exercises.length,
                                                afterAvoidFilter: filteredResult.exercises.length,
                                                finalCount: filteredResult.exercises.length
                                            },
                                            muscleTarget: (prefs === null || prefs === void 0 ? void 0 : prefs.muscleTargets) || [],
                                            muscleLessen: (prefs === null || prefs === void 0 ? void 0 : prefs.muscleLessens) || [],
                                            includeExercises: (prefs === null || prefs === void 0 ? void 0 : prefs.includeExercises) || [],
                                            avoidExercises: (prefs === null || prefs === void 0 ? void 0 : prefs.avoidExercises) || [],
                                            avoidJoints: (prefs === null || prefs === void 0 ? void 0 : prefs.avoidJoints) || []
                                        }, filteredResult.exercises);
                                        clientContext = {
                                            user_id: client.userId,
                                            name: client.userName || client.userEmail,
                                            strength_capacity: filterInput.strengthCapacity,
                                            skill_capacity: filterInput.skillCapacity,
                                            intensity: filterInput.intensity,
                                            primary_goal: filterInput.sessionGoal,
                                            muscle_target: filterInput.muscleTarget,
                                            muscle_lessen: filterInput.muscleLessen,
                                            exercise_requests: {
                                                include: filterInput.includeExercises,
                                                avoid: filterInput.avoidExercises
                                            },
                                            avoid_joints: filterInput.avoidJoints,
                                        };
                                        return [2 /*return*/, {
                                                clientContext: clientContext,
                                                filteredExercises: filteredResult.exercises, // These are already scored
                                            }];
                                }
                            });
                        }); }))];
                case 6:
                    clientProcessingResults = _j.sent();
                    phase1_2Time = Date.now() - phase1_2StartTime;
                    groupWorkoutTestDataLogger.updateTiming(input.sessionId, 'phase1_2', phase1_2Time);
                    clientContexts = clientProcessingResults.map(function (r) { return r.clientContext; });
                    preScoredExercises = new Map();
                    allFilteredExercises = new Map();
                    for (_i = 0, clientProcessingResults_1 = clientProcessingResults; _i < clientProcessingResults_1.length; _i++) {
                        result = clientProcessingResults_1[_i];
                        preScoredExercises.set(result.clientContext.user_id, result.filteredExercises);
                        for (_c = 0, _d = result.filteredExercises; _c < _d.length; _c++) {
                            exercise = _d[_c];
                            // Only add the exercise if we haven't seen it before
                            // This prevents overwriting with different client's scores
                            if (!allFilteredExercises.has(exercise.id)) {
                                score = exercise.score, scoreBreakdown = exercise.scoreBreakdown, cleanExercise = __rest(exercise, ["score", "scoreBreakdown"]);
                                allFilteredExercises.set(exercise.id, cleanExercise);
                            }
                        }
                    }
                    exercisePool = Array.from(allFilteredExercises.values());
                    console.log("\u2705 Total unique exercises across all clients: ".concat(exercisePool.length));
                    // Debug: Verify each client maintains their own scores
                    if (process.env.NODE_ENV === 'development') {
                        console.log('🔍 Verifying individual client scores are preserved:');
                        _loop_2 = function (clientId, exercises_2) {
                            var client = clientContexts.find(function (c) { return c.user_id === clientId; });
                            var sampleExercise = exercises_2.find(function (ex) { return ex.name === 'Landmine Shoulder Press' || ex.name === 'Deadlift'; });
                            if (sampleExercise) {
                                console.log("  Client: ".concat(client === null || client === void 0 ? void 0 : client.name, " (").concat(client === null || client === void 0 ? void 0 : client.intensity, ") - ").concat(sampleExercise.name, ": ").concat(sampleExercise.score));
                            }
                        };
                        for (_e = 0, preScoredExercises_1 = preScoredExercises; _e < preScoredExercises_1.length; _e++) {
                            _f = preScoredExercises_1[_e], clientId = _f[0], exercises_2 = _f[1];
                            _loop_2(clientId, exercises_2);
                        }
                    }
                    groupContext = {
                        clients: clientContexts,
                        sessionId: input.sessionId,
                        businessId: user.businessId,
                        templateType: ((_h = session.templateType) !== null && _h !== void 0 ? _h : 'workout'), // Use session's template or default
                    };
                    // Run Phase A & B to generate blueprint
                    console.log('🚀 Running Phase A & B with GroupContext:', {
                        clientCount: groupContext.clients.length,
                        templateType: groupContext.templateType
                    });
                    _j.label = 7;
                case 7:
                    _j.trys.push([7, 10, , 12]);
                    return [4 /*yield*/, (0, ai_1.generateGroupWorkoutBlueprint)(groupContext, exercisePool, preScoredExercises)];
                case 8:
                    blueprint = _j.sent();
                    console.log('✅ Blueprint generated successfully:', {
                        blockCount: blueprint.blocks.length,
                        warnings: blueprint.validationWarnings
                    });
                    // Save the test data
                    return [4 /*yield*/, groupWorkoutTestDataLogger.saveGroupWorkoutData(input.sessionId)];
                case 9:
                    // Save the test data
                    _j.sent();
                    return [2 /*return*/, {
                            groupContext: groupContext,
                            blueprint: blueprint,
                            summary: {
                                totalClients: clientContexts.length,
                                totalBlocks: blueprint.blocks.length,
                                cohesionWarnings: blueprint.validationWarnings || [],
                            },
                        }];
                case 10:
                    error_2 = _j.sent();
                    console.error('❌ Error generating blueprint:', error_2);
                    // Log detailed error information
                    if (error_2 instanceof Error) {
                        console.error('Error details:', {
                            message: error_2.message,
                            stack: error_2.stack,
                            name: error_2.name
                        });
                        groupWorkoutTestDataLogger.addError(input.sessionId, "".concat(error_2.name, ": ").concat(error_2.message));
                    }
                    else {
                        console.error('Unknown error type:', error_2);
                        groupWorkoutTestDataLogger.addError(input.sessionId, 'Unknown error');
                    }
                    // Save whatever test data we have so far
                    return [4 /*yield*/, groupWorkoutTestDataLogger.saveGroupWorkoutData(input.sessionId)];
                case 11:
                    // Save whatever test data we have so far
                    _j.sent();
                    throw new server_1.TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: error_2 instanceof Error ? error_2.message : 'Failed to generate group workout blueprint',
                    });
                case 12: return [2 /*return*/];
            }
        });
    }); }),
    /**
     * Generate complete group workout with LLM
     * This builds on visualizeGroupWorkout but adds the LLM generation step
     */
    generateGroupWorkout: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        sessionId: v4_1.z.string().uuid()
    }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var user, session, clientIds, _c, clientsData, preferencesData, preferencesByUserId_1, clientsWithPreferences, _d, generateGroupWorkoutBlueprint_1, createLLM, WorkoutPromptBuilder, ExerciseFilterService, _e, HumanMessage, SystemMessage, filterService, exercisePool, groupContext, blueprint, round1Block_1, round2Block_1, round1Assignments_1, round2Assignments_1, clientRequestAssignments_1, usedExercisesPerClient_1, round3Block_1, round4Block_1, promptBuilder, systemPrompt, llmOutput, llm, userMessage, startTime, response, llmTime, jsonMatch, parsedResponse, error_3, error_4;
        var _f;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    console.log('🎯 generateGroupWorkout called with:', { sessionId: input.sessionId });
                    user = (_f = ctx.session) === null || _f === void 0 ? void 0 : _f.user;
                    // Only trainers can generate group workouts
                    if (user.role !== 'trainer') {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'Only trainers can generate group workouts',
                        });
                    }
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 13, , 14]);
                    return [4 /*yield*/, ctx.db
                            .select()
                            .from(schema_1.TrainingSession)
                            .where((0, db_1.eq)(schema_1.TrainingSession.id, input.sessionId))
                            .leftJoin(schema_1.UserTrainingSession, (0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, schema_1.TrainingSession.id))
                            .then(function (rows) {
                            if (rows.length === 0)
                                return null;
                            var session = rows[0].training_session;
                            var trainees = rows
                                .filter(function (row) { var _a; return (_a = row.user_training_session) === null || _a === void 0 ? void 0 : _a.userId; })
                                .map(function (row) { return ({ userId: row.user_training_session.userId, checkedInAt: row.user_training_session.checkedInAt }); });
                            return __assign(__assign({}, session), { trainees: trainees });
                        })];
                case 2:
                    session = _g.sent();
                    if (!session) {
                        throw new server_1.TRPCError({
                            code: 'NOT_FOUND',
                            message: 'Session not found',
                        });
                    }
                    if (session.trainerId !== user.id) {
                        throw new server_1.TRPCError({
                            code: 'FORBIDDEN',
                            message: 'You can only view your own sessions',
                        });
                    }
                    clientIds = session.trainees.map(function (t) { return t.userId; });
                    return [4 /*yield*/, Promise.all([
                            ctx.db
                                .select()
                                .from(schema_1.user)
                                .leftJoin(schema_1.UserProfile, (0, db_1.eq)(schema_1.UserProfile.userId, schema_1.user.id))
                                .where((0, db_1.inArray)(schema_1.user.id, clientIds))
                                .then(function (rows) { return rows.map(function (row) { return (__assign(__assign({}, row.user), { userProfile: row.user_profile })); }); }),
                            ctx.db
                                .select()
                                .from(schema_1.WorkoutPreferences)
                                .where((0, db_1.and)((0, db_1.eq)(schema_1.WorkoutPreferences.trainingSessionId, input.sessionId), (0, db_1.inArray)(schema_1.WorkoutPreferences.userId, clientIds)))
                        ])];
                case 3:
                    _c = _g.sent(), clientsData = _c[0], preferencesData = _c[1];
                    preferencesByUserId_1 = Object.fromEntries(preferencesData.map(function (p) { return [p.userId, p]; }));
                    clientsWithPreferences = clientsData.map(function (client) {
                        var _a, _b, _c;
                        var prefs = preferencesByUserId_1[client.id];
                        var profile = client.userProfile;
                        return {
                            user_id: client.id,
                            name: client.name || 'Unknown',
                            strength_capacity: ((_a = profile === null || profile === void 0 ? void 0 : profile.strengthLevel) !== null && _a !== void 0 ? _a : 'moderate'),
                            skill_capacity: ((_b = profile === null || profile === void 0 ? void 0 : profile.skillLevel) !== null && _b !== void 0 ? _b : 'moderate'),
                            primary_goal: ((prefs === null || prefs === void 0 ? void 0 : prefs.sessionGoal) || 'strength'),
                            intensity: ((prefs === null || prefs === void 0 ? void 0 : prefs.intensity) || 'moderate'),
                            muscle_target: (prefs === null || prefs === void 0 ? void 0 : prefs.muscleTargets) || [],
                            muscle_lessen: (prefs === null || prefs === void 0 ? void 0 : prefs.muscleLessens) || [],
                            exercise_requests: {
                                include: (prefs === null || prefs === void 0 ? void 0 : prefs.includeExercises) || [],
                                avoid: (prefs === null || prefs === void 0 ? void 0 : prefs.avoidExercises) || []
                            },
                            avoid_joints: (prefs === null || prefs === void 0 ? void 0 : prefs.avoidJoints) || [],
                            default_sets: (_c = profile === null || profile === void 0 ? void 0 : profile.defaultSets) !== null && _c !== void 0 ? _c : 20
                        };
                    });
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@acme/ai"); })];
                case 4:
                    _d = _g.sent(), generateGroupWorkoutBlueprint_1 = _d.generateGroupWorkoutBlueprint, createLLM = _d.createLLM, WorkoutPromptBuilder = _d.WorkoutPromptBuilder;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("../services/exercise-filter-service"); })];
                case 5:
                    ExerciseFilterService = (_g.sent()).ExerciseFilterService;
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("@langchain/core/messages"); })];
                case 6:
                    _e = _g.sent(), HumanMessage = _e.HumanMessage, SystemMessage = _e.SystemMessage;
                    filterService = new ExerciseFilterService(ctx.db);
                    return [4 /*yield*/, filterService.fetchBusinessExercises(user.businessId)];
                case 7:
                    exercisePool = _g.sent();
                    groupContext = {
                        clients: clientsWithPreferences,
                        sessionId: input.sessionId,
                        businessId: user.businessId,
                        templateType: 'full_body_bmf' // Using BMF template for testing
                    };
                    return [4 /*yield*/, generateGroupWorkoutBlueprint_1(groupContext, exercisePool)];
                case 8:
                    blueprint = _g.sent();
                    round1Block_1 = blueprint.blocks.find(function (b) { return b.blockId === 'Round1'; });
                    round2Block_1 = blueprint.blocks.find(function (b) { return b.blockId === 'Round2'; });
                    if (!round1Block_1 || !round2Block_1) {
                        throw new Error('Round1 and Round2 blocks are required');
                    }
                    round1Assignments_1 = clientsWithPreferences.map(function (client) {
                        var _a;
                        var clientData = round1Block_1.individualCandidates[client.user_id];
                        var topExercise = (_a = clientData === null || clientData === void 0 ? void 0 : clientData.exercises) === null || _a === void 0 ? void 0 : _a[0]; // Get top candidate
                        if (!topExercise) {
                            throw new Error("No Round 1 exercise found for client ".concat(client.name));
                        }
                        return {
                            clientId: client.user_id,
                            clientName: client.name,
                            exercise: topExercise.name,
                            equipment: getEquipmentFromExercise(topExercise.name)
                        };
                    });
                    round2Assignments_1 = clientsWithPreferences.map(function (client) {
                        var _a;
                        var clientData = round2Block_1.individualCandidates[client.user_id];
                        var topExercise = (_a = clientData === null || clientData === void 0 ? void 0 : clientData.exercises) === null || _a === void 0 ? void 0 : _a[0]; // Get top candidate
                        if (!topExercise) {
                            throw new Error("No Round 2 exercise found for client ".concat(client.name));
                        }
                        return {
                            clientId: client.user_id,
                            clientName: client.name,
                            exercise: topExercise.name,
                            equipment: getEquipmentFromExercise(topExercise.name)
                        };
                    });
                    clientRequestAssignments_1 = {};
                    usedExercisesPerClient_1 = new Map();
                    // Initialize with Round 1 and 2 exercises
                    clientsWithPreferences.forEach(function (client) {
                        var used = new Set();
                        var r1 = round1Assignments_1.find(function (a) { return a.clientId === client.user_id; });
                        var r2 = round2Assignments_1.find(function (a) { return a.clientId === client.user_id; });
                        if (r1)
                            used.add(r1.exercise.toLowerCase());
                        if (r2)
                            used.add(r2.exercise.toLowerCase());
                        usedExercisesPerClient_1.set(client.user_id, used);
                    });
                    round3Block_1 = blueprint.blocks.find(function (b) { return b.blockId === 'Round3'; });
                    round4Block_1 = blueprint.blocks.find(function (b) { return b.blockId === 'FinalRound'; });
                    clientsWithPreferences.forEach(function (client) {
                        var _a;
                        if (!((_a = client.exercise_requests) === null || _a === void 0 ? void 0 : _a.include) || client.exercise_requests.include.length === 0)
                            return;
                        var usedExercises = usedExercisesPerClient_1.get(client.user_id) || new Set();
                        var requestedExercises = client.exercise_requests.include;
                        requestedExercises.forEach(function (requestedName) {
                            var _a, _b;
                            // Skip if already used
                            if (usedExercises.has(requestedName.toLowerCase()))
                                return;
                            // Try to find in Round 3 first
                            var r3Exercises = ((_a = round3Block_1 === null || round3Block_1 === void 0 ? void 0 : round3Block_1.individualCandidates[client.user_id]) === null || _a === void 0 ? void 0 : _a.exercises) || [];
                            var r3Match = r3Exercises.find(function (ex) {
                                var _a;
                                return ex.name.toLowerCase() === requestedName.toLowerCase() &&
                                    ((_a = ex.scoreBreakdown) === null || _a === void 0 ? void 0 : _a.includeExerciseBoost) > 0;
                            });
                            if (r3Match) {
                                if (!clientRequestAssignments_1.Round3)
                                    clientRequestAssignments_1.Round3 = [];
                                clientRequestAssignments_1.Round3.push({
                                    clientId: client.user_id,
                                    clientName: client.name,
                                    exercise: r3Match.name,
                                    equipment: getEquipmentFromExercise(r3Match.name),
                                    roundAssigned: 'Round3',
                                    reason: 'client_request'
                                });
                                usedExercises.add(r3Match.name.toLowerCase());
                                return;
                            }
                            // Try Round 4 if not found in Round 3
                            var r4Exercises = ((_b = round4Block_1 === null || round4Block_1 === void 0 ? void 0 : round4Block_1.individualCandidates[client.user_id]) === null || _b === void 0 ? void 0 : _b.exercises) || [];
                            var r4Match = r4Exercises.find(function (ex) {
                                var _a;
                                return ex.name.toLowerCase() === requestedName.toLowerCase() &&
                                    ((_a = ex.scoreBreakdown) === null || _a === void 0 ? void 0 : _a.includeExerciseBoost) > 0;
                            });
                            if (r4Match) {
                                if (!clientRequestAssignments_1.FinalRound)
                                    clientRequestAssignments_1.FinalRound = [];
                                clientRequestAssignments_1.FinalRound.push({
                                    clientId: client.user_id,
                                    clientName: client.name,
                                    exercise: r4Match.name,
                                    equipment: getEquipmentFromExercise(r4Match.name),
                                    roundAssigned: 'FinalRound',
                                    reason: 'client_request'
                                });
                                usedExercises.add(r4Match.name.toLowerCase());
                            }
                        });
                    });
                    // Process muscle targets deterministically (BMF template only)
                    if (session.templateType === 'full_body_bmf') {
                        clientsWithPreferences.forEach(function (client) {
                            if (!client.muscle_target || client.muscle_target.length === 0)
                                return;
                            var usedExercises = usedExercisesPerClient_1.get(client.user_id) || new Set();
                            var muscleTargets = client.muscle_target;
                            // Check if any muscle targets are already covered
                            var uncoveredTargets = muscleTargets.filter(function (target) {
                                var _a, _b;
                                // Check R1-R4 exercises for this muscle target
                                var r1Exercise = (_a = round1Assignments_1.find(function (a) { return a.clientId === client.user_id; })) === null || _a === void 0 ? void 0 : _a.exercise;
                                var r2Exercise = (_b = round2Assignments_1.find(function (a) { return a.clientId === client.user_id; })) === null || _b === void 0 ? void 0 : _b.exercise;
                                // Simple check - in production, would check actual exercise muscle groups
                                return true; // For now, assume target not covered
                            });
                            // Try to assign uncovered muscle targets
                            uncoveredTargets.forEach(function (muscleTarget) {
                                var _a, _b;
                                // Look for highest scoring exercise targeting this muscle in R3/R4
                                var r3Exercises = ((_a = round3Block_1 === null || round3Block_1 === void 0 ? void 0 : round3Block_1.individualCandidates[client.user_id]) === null || _a === void 0 ? void 0 : _a.exercises) || [];
                                var r4Exercises = ((_b = round4Block_1 === null || round4Block_1 === void 0 ? void 0 : round4Block_1.individualCandidates[client.user_id]) === null || _b === void 0 ? void 0 : _b.exercises) || [];
                                // Find exercise with muscle target boost
                                var r3Match = r3Exercises.find(function (ex) {
                                    var _a;
                                    return !usedExercises.has(ex.name.toLowerCase()) &&
                                        ((_a = ex.scoreBreakdown) === null || _a === void 0 ? void 0 : _a.muscleTargetBonus) > 0;
                                });
                                if (r3Match) {
                                    if (!clientRequestAssignments_1.Round3)
                                        clientRequestAssignments_1.Round3 = [];
                                    // Check if client already has assignment in R3
                                    var existingR3 = clientRequestAssignments_1.Round3.filter(function (a) { return a.clientId === client.user_id; }).length;
                                    if (existingR3 === 0) { // Only assign if slot available
                                        clientRequestAssignments_1.Round3.push({
                                            clientId: client.user_id,
                                            clientName: client.name,
                                            exercise: r3Match.name,
                                            equipment: getEquipmentFromExercise(r3Match.name),
                                            roundAssigned: 'Round3',
                                            reason: 'muscle_target'
                                        });
                                        usedExercises.add(r3Match.name.toLowerCase());
                                        return;
                                    }
                                }
                                // Try R4 if R3 is full or no match
                                var r4Match = r4Exercises.find(function (ex) {
                                    var _a;
                                    return !usedExercises.has(ex.name.toLowerCase()) &&
                                        ((_a = ex.scoreBreakdown) === null || _a === void 0 ? void 0 : _a.muscleTargetBonus) > 0;
                                });
                                if (r4Match) {
                                    if (!clientRequestAssignments_1.FinalRound)
                                        clientRequestAssignments_1.FinalRound = [];
                                    var existingR4 = clientRequestAssignments_1.FinalRound.filter(function (a) { return a.clientId === client.user_id; }).length;
                                    if (existingR4 === 0) {
                                        clientRequestAssignments_1.FinalRound.push({
                                            clientId: client.user_id,
                                            clientName: client.name,
                                            exercise: r4Match.name,
                                            equipment: getEquipmentFromExercise(r4Match.name),
                                            roundAssigned: 'FinalRound',
                                            reason: 'muscle_target'
                                        });
                                        usedExercises.add(r4Match.name.toLowerCase());
                                    }
                                }
                            });
                        });
                    }
                    promptBuilder = new WorkoutPromptBuilder({
                        workoutType: 'group',
                        groupConfig: {
                            clients: clientsWithPreferences,
                            blueprint: blueprint.blocks,
                            deterministicAssignments: __assign({ Round1: round1Assignments_1, Round2: round2Assignments_1 }, clientRequestAssignments_1),
                            equipment: {
                                barbells: 2,
                                benches: 2,
                                cable_machine: 1,
                                row_machine: 1,
                                ab_wheel: 1,
                                bands: 3,
                                bosu_ball: 1,
                                kettlebells: 2,
                                landmine: 1,
                                swiss_ball: 1,
                                deadlift_stations: 2,
                                medicine_balls: 2,
                                dumbbells: "unlimited"
                            },
                            templateType: 'full_body_bmf'
                        }
                    });
                    systemPrompt = promptBuilder.build();
                    llmOutput = "Click 'Generate' to see the actual LLM response";
                    _g.label = 9;
                case 9:
                    _g.trys.push([9, 11, , 12]);
                    llm = createLLM();
                    userMessage = "Generate the group workout assignments for rounds 3 and 4.";
                    console.log('🤖 Calling LLM for group workout generation...');
                    startTime = Date.now();
                    return [4 /*yield*/, llm.invoke([
                            new SystemMessage(systemPrompt),
                            new HumanMessage(userMessage)
                        ])];
                case 10:
                    response = _g.sent();
                    llmTime = Date.now() - startTime;
                    console.log("\u2705 LLM response received in ".concat(llmTime, "ms"));
                    llmOutput = response.content.toString();
                    jsonMatch = llmOutput.match(/```json\n([\s\S]*?)\n```/);
                    if (jsonMatch === null || jsonMatch === void 0 ? void 0 : jsonMatch[1]) {
                        parsedResponse = JSON.parse(jsonMatch[1]);
                        console.log('📊 Parsed LLM response:', parsedResponse);
                    }
                    return [3 /*break*/, 12];
                case 11:
                    error_3 = _g.sent();
                    console.error('❌ Error calling LLM:', error_3);
                    llmOutput = "Error calling LLM: ".concat(error_3 instanceof Error ? error_3.message : 'Unknown error');
                    return [3 /*break*/, 12];
                case 12: return [2 /*return*/, {
                        success: true,
                        debug: {
                            systemPrompt: systemPrompt,
                            userMessage: "Generate the group workout assignments for rounds 3 and 4.",
                            llmOutput: llmOutput
                        },
                        sessionId: input.sessionId,
                        blueprint: blueprint // Include for debugging
                    }];
                case 13:
                    error_4 = _g.sent();
                    console.error('❌ Error in generateGroupWorkout:', error_4);
                    throw new server_1.TRPCError({
                        code: 'INTERNAL_SERVER_ERROR',
                        message: error_4 instanceof Error ? error_4.message : 'Failed to generate group workout',
                    });
                case 14: return [2 /*return*/];
            }
        });
    }); }),
};
var templateObject_1, templateObject_2, templateObject_3;
