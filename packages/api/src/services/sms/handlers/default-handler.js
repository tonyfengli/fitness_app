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
exports.DefaultHandler = void 0;
var messageService_1 = require("../../messageService");
var checkInService_1 = require("../../checkInService");
var logger_1 = require("../../../utils/logger");
var logger = (0, logger_1.createLogger)("DefaultHandler");
var DefaultHandler = /** @class */ (function () {
    function DefaultHandler() {
    }
    DefaultHandler.prototype.handle = function (phoneNumber, messageContent, messageSid, intent) {
        return __awaiter(this, void 0, void 0, function () {
            var responseMessage, userInfo, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        responseMessage = "Sorry, I can only help with session check-ins. Please text 'here' or 'checking in' when you arrive.";
                        logger.info("Non-check-in message received", {
                            intent: intent === null || intent === void 0 ? void 0 : intent.type,
                            phoneNumber: phoneNumber
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, (0, checkInService_1.getUserByPhone)(phoneNumber)];
                    case 2:
                        userInfo = _a.sent();
                        if (!userInfo) return [3 /*break*/, 5];
                        // Save inbound message
                        return [4 /*yield*/, (0, messageService_1.saveMessage)({
                                userId: userInfo.userId,
                                businessId: userInfo.businessId,
                                direction: 'inbound',
                                content: messageContent,
                                phoneNumber: phoneNumber,
                                metadata: {
                                    intent: intent,
                                    twilioMessageSid: messageSid,
                                },
                                status: 'delivered',
                            })];
                    case 3:
                        // Save inbound message
                        _a.sent();
                        // Save outbound response
                        return [4 /*yield*/, (0, messageService_1.saveMessage)({
                                userId: userInfo.userId,
                                businessId: userInfo.businessId,
                                direction: 'outbound',
                                content: responseMessage,
                                phoneNumber: phoneNumber,
                                metadata: {
                                    type: 'generic_response'
                                },
                                status: 'sent',
                            })];
                    case 4:
                        // Save outbound response
                        _a.sent();
                        _a.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_1 = _a.sent();
                        logger.error("Failed to save messages", error_1);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/, {
                            success: true,
                            message: responseMessage,
                            metadata: {
                                intentType: (intent === null || intent === void 0 ? void 0 : intent.type) || 'unknown'
                            }
                        }];
                }
            });
        });
    };
    return DefaultHandler;
}());
exports.DefaultHandler = DefaultHandler;
