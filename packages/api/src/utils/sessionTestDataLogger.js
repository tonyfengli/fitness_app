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
exports.sessionTestDataLogger = void 0;
var fs_1 = require("fs");
var path_1 = require("path");
var logger_1 = require("./logger");
var logger = (0, logger_1.createLogger)('SessionTestDataLogger');
var SessionTestDataLogger = /** @class */ (function () {
    function SessionTestDataLogger() {
        this.sessionData = new Map();
        this.enabled = process.env.SESSION_TEST_DATA_ENABLED === 'true' || true; // Temporarily enabled for testing
    }
    SessionTestDataLogger.prototype.enable = function () {
        this.enabled = true;
        logger.info('Session test data logging enabled');
    };
    SessionTestDataLogger.prototype.disable = function () {
        this.enabled = false;
        logger.info('Session test data logging disabled');
    };
    SessionTestDataLogger.prototype.isEnabled = function () {
        return this.enabled;
    };
    // Initialize a new session
    SessionTestDataLogger.prototype.initSession = function (sessionId, phoneNumber) {
        if (!this.enabled)
            return;
        this.sessionData.set(sessionId, {
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
            phoneNumber: phoneNumber,
            messages: [],
            llmCalls: [],
            exerciseMatcherCalls: [],
            summary: {
                totalMessages: 0,
                totalLLMCalls: 0,
                totalExerciseMatcherCalls: 0,
                llmFallbackCount: 0
            }
        });
        logger.info('Initialized session test data', { sessionId: sessionId, phoneNumber: phoneNumber });
    };
    // Log a message
    SessionTestDataLogger.prototype.logMessage = function (sessionId, message) {
        if (!this.enabled)
            return;
        var session = this.sessionData.get(sessionId);
        if (!session) {
            logger.warn('Session not found for message logging', { sessionId: sessionId });
            return;
        }
        session.messages.push(__assign(__assign({}, message), { timestamp: new Date().toISOString() }));
        session.summary.totalMessages++;
    };
    // Log an LLM call
    SessionTestDataLogger.prototype.logLLMCall = function (sessionId, llmCall) {
        if (!this.enabled)
            return;
        var session = this.sessionData.get(sessionId);
        if (!session) {
            logger.warn('Session not found for LLM call logging', { sessionId: sessionId });
            return;
        }
        session.llmCalls.push(__assign(__assign({}, llmCall), { timestamp: new Date().toISOString() }));
        session.summary.totalLLMCalls++;
    };
    // Log an exercise matcher call
    SessionTestDataLogger.prototype.logExerciseMatcherCall = function (sessionId, matcherCall) {
        if (!this.enabled)
            return;
        var session = this.sessionData.get(sessionId);
        if (!session) {
            logger.warn('Session not found for exercise matcher logging', { sessionId: sessionId });
            return;
        }
        session.exerciseMatcherCalls.push(__assign(__assign({}, matcherCall), { timestamp: new Date().toISOString() }));
        session.summary.totalExerciseMatcherCalls++;
        if (matcherCall.matchMethod === 'llm') {
            session.summary.llmFallbackCount++;
        }
    };
    // Save session data to file
    SessionTestDataLogger.prototype.saveSessionData = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var session, dirPath, timestamp, filename, filepath, latestPath, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.enabled)
                            return [2 /*return*/];
                        session = this.sessionData.get(sessionId);
                        if (!session) {
                            logger.warn('Session not found for saving', { sessionId: sessionId });
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        dirPath = path_1.default.join(process.cwd(), 'session-test-data');
                        return [4 /*yield*/, fs_1.promises.mkdir(dirPath, { recursive: true })];
                    case 2:
                        _a.sent();
                        timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        filename = "session_".concat(sessionId, "_").concat(timestamp, ".json");
                        filepath = path_1.default.join(dirPath, filename);
                        // Write the file
                        return [4 /*yield*/, fs_1.promises.writeFile(filepath, JSON.stringify(session, null, 2), 'utf-8')];
                    case 3:
                        // Write the file
                        _a.sent();
                        logger.info('Session test data saved', {
                            sessionId: sessionId,
                            filepath: filepath,
                            summary: session.summary
                        });
                        latestPath = path_1.default.join(dirPath, 'latest-session.json');
                        return [4 /*yield*/, fs_1.promises.writeFile(latestPath, JSON.stringify(session, null, 2), 'utf-8')];
                    case 4:
                        _a.sent();
                        // Clear session data from memory
                        this.sessionData.delete(sessionId);
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        logger.error('Failed to save session test data', { sessionId: sessionId, error: error_1 });
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    // Get current session data (for debugging)
    SessionTestDataLogger.prototype.getSessionData = function (sessionId) {
        return this.sessionData.get(sessionId);
    };
    // Clear session data
    SessionTestDataLogger.prototype.clearSession = function (sessionId) {
        this.sessionData.delete(sessionId);
    };
    return SessionTestDataLogger;
}());
exports.sessionTestDataLogger = new SessionTestDataLogger();
