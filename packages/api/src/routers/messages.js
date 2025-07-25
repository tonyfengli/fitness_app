"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
exports.messagesRouter = void 0;
var v4_1 = require("zod/v4");
var trpc_1 = require("../trpc");
var client_1 = require("@acme/db/client");
var schema_1 = require("@acme/db/schema");
var db_1 = require("@acme/db");
var server_1 = require("@trpc/server");
exports.messagesRouter = (0, trpc_1.createTRPCRouter)({
    // Get messages for a specific user (trainer view)
    getByUser: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        userId: v4_1.z.string().min(1, "User ID is required"),
    }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var trainer, targetUser, userMessages;
        var _c, _d;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, client_1.db
                        .select()
                        .from(schema_1.user)
                        .where((0, db_1.eq)(schema_1.user.id, ctx.session.user.id))
                        .limit(1)];
                case 1:
                    trainer = _e.sent();
                    if (!trainer.length || ((_c = trainer[0]) === null || _c === void 0 ? void 0 : _c.role) !== "trainer") {
                        throw new server_1.TRPCError({
                            code: "FORBIDDEN",
                            message: "Only trainers can view messages",
                        });
                    }
                    return [4 /*yield*/, client_1.db
                            .select()
                            .from(schema_1.user)
                            .where((0, db_1.eq)(schema_1.user.id, input.userId))
                            .limit(1)];
                case 2:
                    targetUser = _e.sent();
                    if (!targetUser.length || ((_d = targetUser[0]) === null || _d === void 0 ? void 0 : _d.businessId) !== trainer[0].businessId) {
                        throw new server_1.TRPCError({
                            code: "FORBIDDEN",
                            message: "Can only view messages for users in your business",
                        });
                    }
                    return [4 /*yield*/, client_1.db
                            .select({
                            id: schema_1.messages.id,
                            direction: schema_1.messages.direction,
                            content: schema_1.messages.content,
                            metadata: schema_1.messages.metadata,
                            status: schema_1.messages.status,
                            createdAt: schema_1.messages.createdAt,
                        })
                            .from(schema_1.messages)
                            .where((0, db_1.eq)(schema_1.messages.userId, input.userId))
                            .orderBy((0, db_1.desc)(schema_1.messages.createdAt))
                            .limit(100)];
                case 3:
                    userMessages = _e.sent();
                    return [2 /*return*/, userMessages];
            }
        });
    }); }),
    // Get all users with messages for a business (trainer view)
    getUsersWithMessages: trpc_1.protectedProcedure.query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var trainer, businessId, usersWithMessages, uniqueUsers;
        var _c;
        var ctx = _b.ctx;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, client_1.db
                        .select()
                        .from(schema_1.user)
                        .where((0, db_1.eq)(schema_1.user.id, ctx.session.user.id))
                        .limit(1)];
                case 1:
                    trainer = _d.sent();
                    if (!trainer.length || ((_c = trainer[0]) === null || _c === void 0 ? void 0 : _c.role) !== "trainer") {
                        throw new server_1.TRPCError({
                            code: "FORBIDDEN",
                            message: "Only trainers can view messages",
                        });
                    }
                    businessId = trainer[0].businessId;
                    return [4 /*yield*/, client_1.db
                            .selectDistinct({
                            userId: schema_1.messages.userId,
                            userName: schema_1.user.name,
                            userPhone: schema_1.user.phone,
                            lastMessageAt: schema_1.messages.createdAt,
                        })
                            .from(schema_1.messages)
                            .innerJoin(schema_1.user, (0, db_1.eq)(schema_1.messages.userId, schema_1.user.id))
                            .where((0, db_1.eq)(schema_1.messages.businessId, businessId))
                            .orderBy((0, db_1.desc)(schema_1.messages.createdAt))];
                case 2:
                    usersWithMessages = _d.sent();
                    uniqueUsers = usersWithMessages.reduce(function (acc, curr) {
                        if (!acc[curr.userId]) {
                            acc[curr.userId] = {
                                userId: curr.userId,
                                userName: curr.userName,
                                userPhone: curr.userPhone,
                                lastMessageAt: curr.lastMessageAt,
                            };
                        }
                        else {
                            // Keep the most recent message time
                            if (curr.lastMessageAt && (!acc[curr.userId].lastMessageAt ||
                                curr.lastMessageAt > acc[curr.userId].lastMessageAt)) {
                                acc[curr.userId].lastMessageAt = curr.lastMessageAt;
                            }
                        }
                        return acc;
                    }, {});
                    return [2 /*return*/, Object.values(uniqueUsers).sort(function (a, b) { var _a, _b; return (((_a = b.lastMessageAt) === null || _a === void 0 ? void 0 : _a.getTime()) || 0) - (((_b = a.lastMessageAt) === null || _b === void 0 ? void 0 : _b.getTime()) || 0); })];
            }
        });
    }); }),
    // Get message stats for debugging
    getStats: trpc_1.protectedProcedure
        .input(v4_1.z.object({
        userId: v4_1.z.string().optional(),
    }))
        .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var trainer, businessId, whereClause, stats, byDirection, checkInMessages, checkInStats;
        var _c, _d;
        var ctx = _b.ctx, input = _b.input;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, client_1.db
                        .select()
                        .from(schema_1.user)
                        .where((0, db_1.eq)(schema_1.user.id, ctx.session.user.id))
                        .limit(1)];
                case 1:
                    trainer = _e.sent();
                    if (!trainer.length || ((_c = trainer[0]) === null || _c === void 0 ? void 0 : _c.role) !== "trainer") {
                        throw new server_1.TRPCError({
                            code: "FORBIDDEN",
                            message: "Only trainers can view message stats",
                        });
                    }
                    businessId = trainer[0].businessId;
                    whereClause = input.userId
                        ? (0, db_1.and)((0, db_1.eq)(schema_1.messages.businessId, businessId), (0, db_1.eq)(schema_1.messages.userId, input.userId))
                        : (0, db_1.eq)(schema_1.messages.businessId, businessId);
                    return [4 /*yield*/, client_1.db
                            .select({
                            totalMessages: (0, db_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["count(", ")"], ["count(", ")"])), schema_1.messages.id),
                        })
                            .from(schema_1.messages)
                            .where(whereClause)];
                case 2:
                    stats = _e.sent();
                    return [4 /*yield*/, client_1.db
                            .select({
                            direction: schema_1.messages.direction,
                            count: (0, db_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["count(", ")"], ["count(", ")"])), schema_1.messages.id),
                        })
                            .from(schema_1.messages)
                            .where(whereClause)
                            .groupBy(schema_1.messages.direction)];
                case 3:
                    byDirection = _e.sent();
                    return [4 /*yield*/, client_1.db
                            .select({
                            metadata: schema_1.messages.metadata,
                        })
                            .from(schema_1.messages)
                            .where((0, db_1.and)(whereClause, (0, db_1.eq)(schema_1.messages.direction, 'outbound')))];
                case 4:
                    checkInMessages = _e.sent();
                    checkInStats = checkInMessages.reduce(function (acc, msg) {
                        var metadata = msg.metadata;
                        if ((metadata === null || metadata === void 0 ? void 0 : metadata.checkInResult) !== undefined) {
                            acc.total++;
                            if (metadata.checkInResult.success) {
                                acc.successful++;
                            }
                        }
                        return acc;
                    }, { total: 0, successful: 0 });
                    return [2 /*return*/, {
                            totalMessages: ((_d = stats[0]) === null || _d === void 0 ? void 0 : _d.totalMessages) || 0,
                            byDirection: byDirection.reduce(function (acc, curr) {
                                acc[curr.direction] = curr.count;
                                return acc;
                            }, {}),
                            checkInSuccessRate: checkInStats.total > 0
                                ? (checkInStats.successful / checkInStats.total) * 100
                                : 0,
                            checkInTotal: checkInStats.total,
                            checkInSuccessful: checkInStats.successful,
                        }];
            }
        });
    }); }),
});
var templateObject_1, templateObject_2;
