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
exports.TwilioWebhookValidator = void 0;
var twilio_1 = require("twilio");
var logger_1 = require("../../utils/logger");
var logger = (0, logger_1.createLogger)("WebhookValidator");
var TwilioWebhookValidator = /** @class */ (function () {
    function TwilioWebhookValidator() {
        this.authToken = process.env.TWILIO_AUTH_TOKEN || "";
        this.skipValidation =
            process.env.SKIP_TWILIO_VALIDATION === "true" ||
                process.env.NODE_ENV === "development";
    }
    TwilioWebhookValidator.prototype.validateWebhook = function (request, signature) {
        return __awaiter(this, void 0, void 0, function () {
            var formData, params_1, url, webhookUrl, isValid, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        // Check signature header
                        if (!signature) {
                            logger.warn("Missing Twilio signature");
                            return [2 /*return*/, { valid: false, error: "Missing X-Twilio-Signature header" }];
                        }
                        return [4 /*yield*/, request.formData()];
                    case 1:
                        formData = _a.sent();
                        params_1 = {};
                        formData.forEach(function (value, key) {
                            params_1[key] = value.toString();
                        });
                        // Validate required fields
                        if (!params_1.From || !params_1.Body) {
                            return [2 /*return*/, {
                                    valid: false,
                                    error: "Missing required fields: From or Body"
                                }];
                        }
                        // Skip validation in development if configured
                        if (this.skipValidation) {
                            logger.debug("Skipping Twilio signature validation (development mode)");
                            return [2 /*return*/, { valid: true, payload: params_1 }];
                        }
                        // Validate auth token is configured
                        if (!this.authToken) {
                            logger.error("Missing Twilio auth token");
                            return [2 /*return*/, {
                                    valid: false,
                                    error: "Service misconfigured: Missing auth token"
                                }];
                        }
                        url = new URL(request.url);
                        webhookUrl = process.env.TWILIO_WEBHOOK_URL || url.toString();
                        logger.debug("Validating Twilio signature", {
                            webhookUrl: webhookUrl,
                            signature: signature.substring(0, 10) + "...",
                            paramsCount: Object.keys(params_1).length
                        });
                        isValid = (0, twilio_1.validateRequest)(this.authToken, signature, webhookUrl, params_1);
                        if (!isValid) {
                            logger.warn("Invalid Twilio signature", {
                                signature: signature.substring(0, 10) + "...",
                                url: webhookUrl
                            });
                            return [2 /*return*/, { valid: false, error: "Invalid webhook signature" }];
                        }
                        return [2 /*return*/, { valid: true, payload: params_1 }];
                    case 2:
                        error_1 = _a.sent();
                        logger.error("Webhook validation error", error_1);
                        return [2 /*return*/, {
                                valid: false,
                                error: error_1 instanceof Error ? error_1.message : "Validation failed"
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    TwilioWebhookValidator.prototype.extractPayload = function (params) {
        // Ensure required fields are present
        if (!params.MessageSid || !params.From || !params.To || !params.Body) {
            throw new Error("Missing required SMS fields");
        }
        return {
            MessageSid: params.MessageSid,
            SmsSid: params.SmsSid || params.MessageSid, // Fallback to MessageSid
            AccountSid: params.AccountSid || "",
            MessagingServiceSid: params.MessagingServiceSid,
            From: params.From,
            To: params.To,
            Body: params.Body,
            NumMedia: params.NumMedia,
        };
    };
    return TwilioWebhookValidator;
}());
exports.TwilioWebhookValidator = TwilioWebhookValidator;
