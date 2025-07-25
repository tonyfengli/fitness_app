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
exports.setBroadcastFunction = setBroadcastFunction;
exports.getUserByPhone = getUserByPhone;
exports.processCheckIn = processCheckIn;
var client_1 = require("@acme/db/client");
var db_1 = require("@acme/db");
var schema_1 = require("@acme/db/schema");
var twilio_1 = require("./twilio");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.createLogger)("CheckInService");
// Type for the broadcast function - will be injected from the API layer
var broadcastCheckInEvent = null;
function setBroadcastFunction(fn) {
    broadcastCheckInEvent = fn;
}
function getUserByPhone(phoneNumber) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedPhone, foundUser, activeSession, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    normalizedPhone = (0, twilio_1.normalizePhoneNumber)(phoneNumber);
                    return [4 /*yield*/, client_1.db
                            .select()
                            .from(schema_1.user)
                            .where((0, db_1.eq)(schema_1.user.phone, normalizedPhone))
                            .limit(1)];
                case 1:
                    foundUser = _b.sent();
                    if (!foundUser.length || !foundUser[0]) {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, client_1.db
                            .select({
                            sessionId: schema_1.UserTrainingSession.trainingSessionId
                        })
                            .from(schema_1.UserTrainingSession)
                            .innerJoin(schema_1.TrainingSession, (0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, schema_1.TrainingSession.id))
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.UserTrainingSession.userId, foundUser[0].id), (0, db_1.eq)(schema_1.UserTrainingSession.status, "checked_in"), (0, db_1.eq)(schema_1.TrainingSession.status, "open")))
                            .limit(1)];
                case 2:
                    activeSession = _b.sent();
                    return [2 /*return*/, {
                            userId: foundUser[0].id,
                            businessId: foundUser[0].businessId || '',
                            trainingSessionId: (_a = activeSession[0]) === null || _a === void 0 ? void 0 : _a.sessionId,
                        }];
                case 3:
                    error_1 = _b.sent();
                    logger.error("Error finding user by phone", error_1);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function processCheckIn(phoneNumber) {
    return __awaiter(this, void 0, void 0, function () {
        var normalizedPhone, foundUser, clientUser, now, openSession, session, existingCheckIn, newCheckInResult, newCheckIn, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, , 9]);
                    normalizedPhone = (0, twilio_1.normalizePhoneNumber)(phoneNumber);
                    logger.info("Processing check-in", {
                        originalPhone: phoneNumber,
                        normalizedPhone: normalizedPhone
                    });
                    // 1. Find user by normalized phone number only
                    logger.info("Searching for user with normalized phone", { normalizedPhone: normalizedPhone });
                    return [4 /*yield*/, client_1.db
                            .select()
                            .from(schema_1.user)
                            .where((0, db_1.eq)(schema_1.user.phone, normalizedPhone))
                            .limit(1)];
                case 1:
                    foundUser = _a.sent();
                    if (!foundUser.length || !foundUser[0]) {
                        logger.warn("No user found for normalized phone", {
                            normalizedPhone: normalizedPhone,
                            originalPhone: phoneNumber
                        });
                        return [2 /*return*/, {
                                success: false,
                                message: "We couldn't find your account. Contact your trainer to get set up.",
                            }];
                    }
                    clientUser = foundUser[0];
                    logger.info("User found", { userId: clientUser.id, businessId: clientUser.businessId, name: clientUser.name });
                    now = new Date();
                    return [4 /*yield*/, client_1.db
                            .select()
                            .from(schema_1.TrainingSession)
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.TrainingSession.businessId, clientUser.businessId), (0, db_1.eq)(schema_1.TrainingSession.status, "open")))
                            .limit(1)];
                case 2:
                    openSession = _a.sent();
                    if (!openSession.length || !openSession[0]) {
                        logger.warn("No open session found", { businessId: clientUser.businessId });
                        return [2 /*return*/, {
                                success: false,
                                message: "Hello ".concat(clientUser.name, "! There's no open session at your gym right now. Please check with your trainer."),
                            }];
                    }
                    session = openSession[0];
                    logger.info("Open session found", { sessionId: session.id });
                    return [4 /*yield*/, client_1.db
                            .select()
                            .from(schema_1.UserTrainingSession)
                            .where((0, db_1.and)((0, db_1.eq)(schema_1.UserTrainingSession.userId, clientUser.id), (0, db_1.eq)(schema_1.UserTrainingSession.trainingSessionId, session.id)))
                            .limit(1)];
                case 3:
                    existingCheckIn = _a.sent();
                    if (existingCheckIn.length && existingCheckIn[0] && existingCheckIn[0].status === "checked_in") {
                        logger.info("User already checked in", { userId: clientUser.id, sessionId: session.id });
                        return [2 /*return*/, {
                                success: true,
                                message: "Hello ".concat(clientUser.name, "! You're already checked in for this session!"),
                                userId: clientUser.id,
                                businessId: clientUser.businessId,
                                sessionId: session.id,
                                checkInId: existingCheckIn[0].id,
                                phoneNumber: normalizedPhone,
                                shouldStartPreferences: existingCheckIn[0].preferenceCollectionStep === "not_started",
                            }];
                    }
                    if (!(existingCheckIn.length && existingCheckIn[0])) return [3 /*break*/, 5];
                    // Update existing registration to checked_in
                    return [4 /*yield*/, client_1.db
                            .update(schema_1.UserTrainingSession)
                            .set({
                            status: "checked_in",
                            checkedInAt: now,
                        })
                            .where((0, db_1.eq)(schema_1.UserTrainingSession.id, existingCheckIn[0].id))];
                case 4:
                    // Update existing registration to checked_in
                    _a.sent();
                    logger.info("Updated check-in status", {
                        userId: clientUser.id,
                        sessionId: session.id,
                        checkInId: existingCheckIn[0].id
                    });
                    // Broadcast check-in event if broadcast function is available
                    if (broadcastCheckInEvent) {
                        logger.info("Broadcasting check-in event", {
                            sessionId: session.id,
                            userId: clientUser.id,
                            name: clientUser.name
                        });
                        broadcastCheckInEvent(session.id, {
                            userId: clientUser.id,
                            name: clientUser.name || "Unknown",
                            checkedInAt: now.toISOString()
                        });
                    }
                    else {
                        logger.warn("Broadcast function not available");
                    }
                    return [2 /*return*/, {
                            success: true,
                            message: "Hello ".concat(clientUser.name, "! You're checked in for the session. Welcome!"),
                            userId: clientUser.id,
                            businessId: clientUser.businessId,
                            sessionId: session.id,
                            checkInId: existingCheckIn[0].id,
                            phoneNumber: normalizedPhone,
                            shouldStartPreferences: true, // Always true for new check-ins
                        }];
                case 5: return [4 /*yield*/, client_1.db
                        .insert(schema_1.UserTrainingSession)
                        .values({
                        userId: clientUser.id,
                        trainingSessionId: session.id,
                        status: "checked_in",
                        checkedInAt: now,
                    })
                        .returning()];
                case 6:
                    newCheckInResult = _a.sent();
                    newCheckIn = newCheckInResult[0];
                    if (!newCheckIn) {
                        throw new Error("Failed to create check-in record");
                    }
                    logger.info("Created new check-in", {
                        userId: clientUser.id,
                        sessionId: session.id,
                        checkInId: newCheckIn.id
                    });
                    // Broadcast check-in event if broadcast function is available
                    if (broadcastCheckInEvent) {
                        logger.info("Broadcasting check-in event", {
                            sessionId: session.id,
                            userId: clientUser.id,
                            name: clientUser.name
                        });
                        broadcastCheckInEvent(session.id, {
                            userId: clientUser.id,
                            name: clientUser.name || "Unknown",
                            checkedInAt: now.toISOString()
                        });
                    }
                    else {
                        logger.warn("Broadcast function not available");
                    }
                    return [2 /*return*/, {
                            success: true,
                            message: "Hello ".concat(clientUser.name, "! You're checked in for the session. Welcome!"),
                            userId: clientUser.id,
                            businessId: clientUser.businessId,
                            sessionId: session.id,
                            checkInId: newCheckIn.id,
                            phoneNumber: normalizedPhone,
                            shouldStartPreferences: true, // Always true for new check-ins
                        }];
                case 7: return [3 /*break*/, 9];
                case 8:
                    error_2 = _a.sent();
                    logger.error("Check-in processing failed", error_2);
                    return [2 /*return*/, {
                            success: false,
                            message: "Sorry, something went wrong. Please try again or contact your trainer.",
                        }];
                case 9: return [2 /*return*/];
            }
        });
    });
}
