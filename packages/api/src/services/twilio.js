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
exports.twilioClient = void 0;
exports.sendSMS = sendSMS;
exports.normalizePhoneNumber = normalizePhoneNumber;
var twilio_1 = require("twilio");
var accountSid = process.env.TWILIO_ACCOUNT_SID;
var authToken = process.env.TWILIO_AUTH_TOKEN;
var apiKey = process.env.TWILIO_API_KEY;
var apiSecret = process.env.TWILIO_API_SECRET;
var twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
// Only initialize Twilio client if credentials are provided
// Use API Key if available (more secure), otherwise fall back to Auth Token
exports.twilioClient = apiKey && apiSecret
    ? new twilio_1.Twilio(apiKey, apiSecret, { accountSid: accountSid })
    : accountSid && authToken
        ? new twilio_1.Twilio(accountSid, authToken)
        : null;
function sendSMS(to, body) {
    return __awaiter(this, void 0, void 0, function () {
        var message, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!exports.twilioClient) {
                        console.error("Twilio client not initialized - missing credentials");
                        return [2 /*return*/, { success: false, error: "Twilio not configured" }];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, exports.twilioClient.messages.create({
                            body: body,
                            from: twilioPhoneNumber,
                            to: to,
                        })];
                case 2:
                    message = _a.sent();
                    console.log("SMS sent successfully: ".concat(message.sid));
                    return [2 /*return*/, { success: true, messageId: message.sid }];
                case 3:
                    error_1 = _a.sent();
                    console.error("Failed to send SMS:", error_1);
                    return [2 /*return*/, { success: false, error: error_1 }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function normalizePhoneNumber(phone) {
    // Remove all non-numeric characters
    var cleaned = phone.replace(/\D/g, "");
    // Add country code if not present (assuming US)
    if (cleaned.length === 10) {
        return "+1".concat(cleaned);
    }
    // If already has country code
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
        return "+".concat(cleaned);
    }
    // Return as-is if already in E.164 format
    if (phone.startsWith("+")) {
        return phone;
    }
    // Default case - return with + prefix
    return "+".concat(cleaned);
}
