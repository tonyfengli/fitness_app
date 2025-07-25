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
exports.authRouter = void 0;
var zod_1 = require("zod");
var crypto_1 = require("better-auth/crypto");
var db_1 = require("@acme/db");
var schema_1 = require("@acme/db/schema");
var trpc_1 = require("../trpc");
var twilio_1 = require("../services/twilio");
exports.authRouter = {
    getSession: trpc_1.publicProcedure.query(function (_a) {
        var ctx = _a.ctx;
        return ctx.session;
    }),
    getSecretMessage: trpc_1.protectedProcedure.query(function () {
        return "you can see this secret message!";
    }),
    getUserRole: trpc_1.protectedProcedure.query(function (_a) {
        var _b;
        var ctx = _a.ctx;
        if (!((_b = ctx.session) === null || _b === void 0 ? void 0 : _b.user)) {
            return null;
        }
        var user = ctx.session.user;
        return {
            role: user.role || 'client',
            businessId: user.businessId,
        };
    }),
    isTrainer: trpc_1.protectedProcedure.query(function (_a) {
        var _b;
        var ctx = _a.ctx;
        var user = (_b = ctx.session) === null || _b === void 0 ? void 0 : _b.user;
        return (user === null || user === void 0 ? void 0 : user.role) === 'trainer';
    }),
    updateUserBusiness: trpc_1.protectedProcedure
        .input(zod_1.z.object({ businessId: zod_1.z.string().uuid() }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var _c, _d;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!((_d = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.id)) {
                        throw new Error("No user ID in session");
                    }
                    return [4 /*yield*/, ctx.db
                            .update(schema_1.user)
                            .set({ businessId: input.businessId })
                            .where((0, db_1.eq)(schema_1.user.id, ctx.session.user.id))];
                case 1:
                    _e.sent();
                    return [2 /*return*/, { success: true }];
            }
        });
    }); }),
    getClientsByBusiness: trpc_1.protectedProcedure.query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, businessId, clients;
        var _c;
        var ctx = _b.ctx;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    currentUser = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    if ((currentUser === null || currentUser === void 0 ? void 0 : currentUser.role) !== 'trainer') {
                        throw new Error("Only trainers can view all clients");
                    }
                    businessId = currentUser.businessId;
                    if (!businessId) {
                        throw new Error("Trainer must be associated with a business");
                    }
                    return [4 /*yield*/, ctx.db.query.user.findMany({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.user.businessId, businessId), (0, db_1.eq)(schema_1.user.role, 'client')),
                            columns: {
                                id: true,
                                email: true,
                                phone: true,
                                name: true,
                                createdAt: true,
                            },
                            with: {
                                userProfiles: {
                                    columns: {
                                        strengthLevel: true,
                                        skillLevel: true,
                                        notes: true,
                                    },
                                    limit: 1,
                                }
                            },
                            orderBy: function (user, _a) {
                                var asc = _a.asc;
                                return [asc(user.name)];
                            },
                        })];
                case 1:
                    clients = _d.sent();
                    // Transform the data to have a single profile object
                    return [2 /*return*/, clients.map(function (client) {
                            var _a;
                            return (__assign(__assign({}, client), { profile: ((_a = client.userProfiles) === null || _a === void 0 ? void 0 : _a[0]) || null, userProfiles: undefined }));
                        })];
            }
        });
    }); }),
    updateClientProfile: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        userId: zod_1.z.string(),
        strengthLevel: zod_1.z.enum(["very_low", "low", "moderate", "high"]),
        skillLevel: zod_1.z.enum(["very_low", "low", "moderate", "high"]),
        notes: zod_1.z.string().optional(),
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, businessId, client, existingProfile;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    currentUser = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    if ((currentUser === null || currentUser === void 0 ? void 0 : currentUser.role) !== 'trainer') {
                        throw new Error("Only trainers can update client profiles");
                    }
                    businessId = currentUser.businessId;
                    if (!businessId) {
                        throw new Error("Trainer must be associated with a business");
                    }
                    return [4 /*yield*/, ctx.db.query.user.findFirst({
                            where: (0, db_1.and)((0, db_1.eq)(schema_1.user.id, input.userId), (0, db_1.eq)(schema_1.user.businessId, businessId), (0, db_1.eq)(schema_1.user.role, 'client')),
                        })];
                case 1:
                    client = _d.sent();
                    if (!client) {
                        throw new Error("Client not found or not in your business");
                    }
                    return [4 /*yield*/, ctx.db.query.UserProfile.findFirst({
                            where: (0, db_1.eq)(schema_1.UserProfile.userId, input.userId),
                        })];
                case 2:
                    existingProfile = _d.sent();
                    if (!existingProfile) return [3 /*break*/, 4];
                    // Update existing profile
                    return [4 /*yield*/, ctx.db
                            .update(schema_1.UserProfile)
                            .set({
                            strengthLevel: input.strengthLevel,
                            skillLevel: input.skillLevel,
                            notes: input.notes,
                        })
                            .where((0, db_1.eq)(schema_1.UserProfile.userId, input.userId))];
                case 3:
                    // Update existing profile
                    _d.sent();
                    return [3 /*break*/, 6];
                case 4: 
                // Create new profile
                return [4 /*yield*/, ctx.db.insert(schema_1.UserProfile).values({
                        userId: input.userId,
                        businessId: businessId,
                        strengthLevel: input.strengthLevel,
                        skillLevel: input.skillLevel,
                        notes: input.notes,
                    })];
                case 5:
                    // Create new profile
                    _d.sent();
                    _d.label = 6;
                case 6: return [2 /*return*/, { success: true }];
            }
        });
    }); }),
    createUserProfile: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        userId: zod_1.z.string(),
        businessId: zod_1.z.string().uuid(),
        strengthLevel: zod_1.z.enum(["very_low", "low", "moderate", "high"]),
        skillLevel: zod_1.z.enum(["very_low", "low", "moderate", "high"]),
        notes: zod_1.z.string().optional(),
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, isOwnProfile, isTrainer, existingProfile;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    currentUser = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    isOwnProfile = (currentUser === null || currentUser === void 0 ? void 0 : currentUser.id) === input.userId;
                    isTrainer = (currentUser === null || currentUser === void 0 ? void 0 : currentUser.role) === 'trainer';
                    if (!isOwnProfile && !isTrainer) {
                        throw new Error("You can only create your own profile or a trainer can create client profiles");
                    }
                    return [4 /*yield*/, ctx.db.query.UserProfile.findFirst({
                            where: (0, db_1.eq)(schema_1.UserProfile.userId, input.userId),
                        })];
                case 1:
                    existingProfile = _d.sent();
                    if (existingProfile) {
                        throw new Error("User profile already exists");
                    }
                    // Create new profile
                    return [4 /*yield*/, ctx.db.insert(schema_1.UserProfile).values({
                            userId: input.userId,
                            businessId: input.businessId,
                            strengthLevel: input.strengthLevel,
                            skillLevel: input.skillLevel,
                            notes: input.notes,
                        })];
                case 2:
                    // Create new profile
                    _d.sent();
                    return [2 /*return*/, { success: true }];
            }
        });
    }); }),
    createUserAsTrainer: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(6),
        name: zod_1.z.string(),
        phone: zod_1.z.string().optional(),
        role: zod_1.z.enum(["client", "trainer"]),
        strengthLevel: zod_1.z.enum(["very_low", "low", "moderate", "high"]).optional(),
        skillLevel: zod_1.z.enum(["very_low", "low", "moderate", "high"]).optional(),
    }))
        .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var currentUser, businessId, existingUser, hashedPassword, userId, now, normalizedPhone, accountId;
        var _c;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    currentUser = (_c = ctx.session) === null || _c === void 0 ? void 0 : _c.user;
                    if ((currentUser === null || currentUser === void 0 ? void 0 : currentUser.role) !== 'trainer') {
                        throw new Error("Only trainers can create users");
                    }
                    businessId = currentUser.businessId;
                    if (!businessId) {
                        throw new Error("Trainer must be associated with a business");
                    }
                    return [4 /*yield*/, ctx.db.query.user.findFirst({
                            where: (0, db_1.eq)(schema_1.user.email, input.email),
                        })];
                case 1:
                    existingUser = _d.sent();
                    if (existingUser) {
                        throw new Error("User with this email already exists");
                    }
                    return [4 /*yield*/, (0, crypto_1.hashPassword)(input.password)];
                case 2:
                    hashedPassword = _d.sent();
                    userId = crypto.randomUUID();
                    now = new Date();
                    normalizedPhone = input.phone ? (0, twilio_1.normalizePhoneNumber)(input.phone) : null;
                    // Create the user
                    return [4 /*yield*/, ctx.db.insert(schema_1.user).values({
                            id: userId,
                            email: input.email,
                            name: input.name,
                            phone: normalizedPhone,
                            role: input.role,
                            businessId: businessId,
                            emailVerified: false,
                            createdAt: now,
                            updatedAt: now,
                        })];
                case 3:
                    // Create the user
                    _d.sent();
                    accountId = crypto.randomUUID();
                    return [4 /*yield*/, ctx.db.insert(schema_1.account).values({
                            id: accountId,
                            userId: userId,
                            providerId: "credential",
                            accountId: input.email,
                            password: hashedPassword,
                            createdAt: now,
                            updatedAt: now,
                        })];
                case 4:
                    _d.sent();
                    if (!(input.role === "client" && input.strengthLevel && input.skillLevel)) return [3 /*break*/, 6];
                    return [4 /*yield*/, ctx.db.insert(schema_1.UserProfile).values({
                            userId: userId,
                            businessId: businessId,
                            strengthLevel: input.strengthLevel,
                            skillLevel: input.skillLevel,
                        })];
                case 5:
                    _d.sent();
                    _d.label = 6;
                case 6: return [2 /*return*/, {
                        success: true,
                        userId: userId,
                    }];
            }
        });
    }); }),
};
