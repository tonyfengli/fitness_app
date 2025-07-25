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
exports.SMSWebhookHandler = void 0;
var workoutPreferenceService_1 = require("../workoutPreferenceService");
var conversationStateService_1 = require("../conversationStateService");
var checkInService_1 = require("../checkInService");
var logger_1 = require("../../utils/logger");
var webhook_validator_1 = require("./webhook-validator");
var intent_router_1 = require("./intent-router");
var check_in_handler_1 = require("./handlers/check-in-handler");
var preference_handler_1 = require("./handlers/preference-handler");
var disambiguation_handler_1 = require("./handlers/disambiguation-handler");
var preference_update_handler_1 = require("./handlers/preference-update-handler");
var default_handler_1 = require("./handlers/default-handler");
var response_sender_1 = require("./response-sender");
var logger = (0, logger_1.createLogger)("SMSWebhookHandler");
var SMSWebhookHandler = /** @class */ (function () {
    function SMSWebhookHandler() {
        this.validator = new webhook_validator_1.TwilioWebhookValidator();
        this.intentRouter = new intent_router_1.SMSIntentRouter();
        this.checkInHandler = new check_in_handler_1.CheckInHandler();
        this.preferenceHandler = new preference_handler_1.PreferenceHandler();
        this.disambiguationHandler = new disambiguation_handler_1.DisambiguationHandler();
        this.preferenceUpdateHandler = new preference_update_handler_1.PreferenceUpdateHandler();
        this.defaultHandler = new default_handler_1.DefaultHandler();
        this.responseSender = new response_sender_1.SMSResponseSender();
    }
    SMSWebhookHandler.prototype.handleWebhook = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var signature, validation, payload, response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        signature = request.headers.get("X-Twilio-Signature");
                        return [4 /*yield*/, this.validator.validateWebhook(request, signature)];
                    case 1:
                        validation = _a.sent();
                        if (!validation.valid) {
                            logger.warn("Webhook validation failed", { error: validation.error });
                            return [2 /*return*/, new Response(validation.error || "Unauthorized", { status: 401 })];
                        }
                        payload = void 0;
                        try {
                            payload = this.validator.extractPayload(validation.payload);
                        }
                        catch (error) {
                            logger.error("Failed to extract SMS payload", error);
                            return [2 /*return*/, new Response("Bad Request: Invalid SMS payload", { status: 400 })];
                        }
                        logger.info("Incoming SMS", {
                            from: payload.From,
                            body: payload.Body,
                            messageSid: payload.MessageSid
                        });
                        return [4 /*yield*/, this.routeAndHandle(payload)];
                    case 2:
                        response = _a.sent();
                        // Step 3: Send SMS response asynchronously
                        this.responseSender.sendResponseAsync(payload.From, response.message);
                        // Return success immediately to Twilio
                        return [2 /*return*/, new Response("", { status: 200 })];
                    case 3:
                        error_1 = _a.sent();
                        logger.error("SMS webhook handler error", error_1);
                        return [2 /*return*/, new Response("Internal Server Error", { status: 500 })];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    SMSWebhookHandler.prototype.routeAndHandle = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var disambiguationCheck, userInfo, pendingDisambiguation, preferenceCheck, interpretation, _a, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 16, , 17]);
                        disambiguationCheck = disambiguation_handler_1.DisambiguationHandler.isDisambiguationResponse(payload.Body);
                        if (!disambiguationCheck.isValid) return [3 /*break*/, 4];
                        return [4 /*yield*/, (0, checkInService_1.getUserByPhone)(payload.From)];
                    case 1:
                        userInfo = _b.sent();
                        if (!(userInfo && userInfo.trainingSessionId)) return [3 /*break*/, 4];
                        return [4 /*yield*/, conversationStateService_1.ConversationStateService.getPendingDisambiguation(userInfo.userId, userInfo.trainingSessionId)];
                    case 2:
                        pendingDisambiguation = _b.sent();
                        if (!pendingDisambiguation) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.disambiguationHandler.handle(payload.From, payload.Body, payload.MessageSid)];
                    case 3: return [2 /*return*/, _b.sent()];
                    case 4: return [4 /*yield*/, workoutPreferenceService_1.WorkoutPreferenceService.isAwaitingPreferences(payload.From)];
                    case 5:
                        preferenceCheck = _b.sent();
                        if (!preferenceCheck.waiting) return [3 /*break*/, 9];
                        if (!(preferenceCheck.currentStep === "preferences_active")) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.preferenceUpdateHandler.handle(payload.From, payload.Body, payload.MessageSid)];
                    case 6: return [2 /*return*/, _b.sent()];
                    case 7: return [4 /*yield*/, this.preferenceHandler.handle(payload.From, payload.Body, payload.MessageSid, preferenceCheck)];
                    case 8: 
                    // Otherwise handle normal preference collection flow
                    return [2 /*return*/, _b.sent()];
                    case 9: return [4 /*yield*/, this.intentRouter.interpretMessage(payload.Body)];
                    case 10:
                        interpretation = _b.sent();
                        _a = interpretation.intent.type;
                        switch (_a) {
                            case "check_in": return [3 /*break*/, 11];
                        }
                        return [3 /*break*/, 13];
                    case 11: return [4 /*yield*/, this.checkInHandler.handle(payload.From, payload.Body, payload.MessageSid, interpretation.intent)];
                    case 12: return [2 /*return*/, _b.sent()];
                    case 13: return [4 /*yield*/, this.defaultHandler.handle(payload.From, payload.Body, payload.MessageSid, interpretation.intent)];
                    case 14: return [2 /*return*/, _b.sent()];
                    case 15: return [3 /*break*/, 17];
                    case 16:
                        error_2 = _b.sent();
                        logger.error("Message routing error", error_2);
                        // Return a safe error message
                        return [2 /*return*/, {
                                success: false,
                                message: "Sorry, we're having trouble processing your message. Please try again later."
                            }];
                    case 17: return [2 /*return*/];
                }
            });
        });
    };
    return SMSWebhookHandler;
}());
exports.SMSWebhookHandler = SMSWebhookHandler;
