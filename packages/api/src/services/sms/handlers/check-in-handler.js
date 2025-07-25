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
exports.CheckInHandler = void 0;
var checkInService_1 = require("../../checkInService");
var messageService_1 = require("../../messageService");
var logger_1 = require("../../../utils/logger");
var workoutPreferenceService_1 = require("../../workoutPreferenceService");
var client_1 = require("@acme/db/client");
var schema_1 = require("@acme/db/schema");
var db_1 = require("@acme/db");
var logger = (0, logger_1.createLogger)("CheckInHandler");
var CheckInHandler = /** @class */ (function () {
    function CheckInHandler() {
    }
    CheckInHandler.prototype.handle = function (phoneNumber, messageContent, messageSid, intent) {
        return __awaiter(this, void 0, void 0, function () {
            var checkInResult, responseMessage, userInfo, userName, _a, preferencePrompt, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 8, , 9]);
                        return [4 /*yield*/, (0, checkInService_1.processCheckIn)(phoneNumber)];
                    case 1:
                        checkInResult = _b.sent();
                        logger.info("Check-in processed", {
                            success: checkInResult.success,
                            userId: checkInResult.userId,
                            sessionId: checkInResult.sessionId,
                            shouldStartPreferences: checkInResult.shouldStartPreferences,
                        });
                        responseMessage = checkInResult.message;
                        if (!(checkInResult.success && checkInResult.shouldStartPreferences)) return [3 /*break*/, 6];
                        return [4 /*yield*/, (0, checkInService_1.getUserByPhone)(phoneNumber)];
                    case 2:
                        userInfo = _b.sent();
                        if (!userInfo) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.getUserName(userInfo.userId)];
                    case 3:
                        _a = _b.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _a = undefined;
                        _b.label = 5;
                    case 5:
                        userName = _a;
                        preferencePrompt = workoutPreferenceService_1.WorkoutPreferenceService.getPreferencePrompt(userName);
                        responseMessage = "".concat(responseMessage, "\n\n").concat(preferencePrompt);
                        logger.info("Added preference prompt to check-in response", {
                            userId: checkInResult.userId,
                            sessionId: checkInResult.sessionId,
                            userName: userName
                        });
                        _b.label = 6;
                    case 6: 
                    // Save messages
                    return [4 /*yield*/, this.saveMessages(phoneNumber, messageContent, responseMessage, messageSid, intent, checkInResult)];
                    case 7:
                        // Save messages
                        _b.sent();
                        return [2 /*return*/, {
                                success: true,
                                message: responseMessage,
                                metadata: {
                                    userId: checkInResult.userId,
                                    businessId: checkInResult.businessId,
                                    sessionId: checkInResult.sessionId,
                                    checkInSuccess: checkInResult.success
                                }
                            }];
                    case 8:
                        error_1 = _b.sent();
                        logger.error("Check-in handler error", error_1);
                        throw error_1;
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    CheckInHandler.prototype.saveMessages = function (phoneNumber, inboundContent, outboundContent, messageSid, intent, checkInResult) {
        return __awaiter(this, void 0, void 0, function () {
            var userInfo, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, (0, checkInService_1.getUserByPhone)(phoneNumber)];
                    case 1:
                        userInfo = _a.sent();
                        if (!userInfo) {
                            logger.warn("User not found for message saving", { phoneNumber: phoneNumber });
                            return [2 /*return*/];
                        }
                        // Save inbound message
                        return [4 /*yield*/, (0, messageService_1.saveMessage)({
                                userId: userInfo.userId,
                                businessId: userInfo.businessId,
                                direction: 'inbound',
                                content: inboundContent,
                                phoneNumber: phoneNumber,
                                metadata: {
                                    intent: intent,
                                    twilioMessageSid: messageSid,
                                },
                                status: 'delivered',
                            })];
                    case 2:
                        // Save inbound message
                        _a.sent();
                        // Save outbound response
                        return [4 /*yield*/, (0, messageService_1.saveMessage)({
                                userId: userInfo.userId,
                                businessId: userInfo.businessId,
                                direction: 'outbound',
                                content: outboundContent,
                                phoneNumber: phoneNumber,
                                metadata: {
                                    checkInResult: checkInResult.success
                                        ? { success: true, sessionId: checkInResult.sessionId }
                                        : { success: false },
                                },
                                status: 'sent',
                            })];
                    case 3:
                        // Save outbound response
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        logger.error("Failed to save messages", error_2);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    CheckInHandler.prototype.getUserName = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var userRecord, error_3;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, client_1.db
                                .select({ name: schema_1.user.name })
                                .from(schema_1.user)
                                .where((0, db_1.eq)(schema_1.user.id, userId))
                                .limit(1)];
                    case 1:
                        userRecord = _b.sent();
                        return [2 /*return*/, ((_a = userRecord[0]) === null || _a === void 0 ? void 0 : _a.name) || undefined];
                    case 2:
                        error_3 = _b.sent();
                        logger.error("Failed to get user name", { userId: userId, error: error_3 });
                        return [2 /*return*/, undefined];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return CheckInHandler;
}());
exports.CheckInHandler = CheckInHandler;
