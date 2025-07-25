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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationStateService = void 0;
var client_1 = require("@acme/db/client");
var schema_1 = require("@acme/db/schema");
var db_1 = require("@acme/db");
var logger_1 = require("../utils/logger");
var logger = (0, logger_1.createLogger)("ConversationStateService");
var ConversationStateService = /** @class */ (function () {
    function ConversationStateService() {
    }
    /**
     * Create a new conversation state for exercise disambiguation
     */
    ConversationStateService.createExerciseDisambiguation = function (userId, trainingSessionId, businessId, userInput, options) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        logger.info("Creating exercise disambiguation state", {
                            userId: userId,
                            trainingSessionId: trainingSessionId,
                            userInput: userInput,
                            optionCount: options.length
                        });
                        return [4 /*yield*/, client_1.db
                                .insert(schema_1.conversationState)
                                .values({
                                userId: userId,
                                trainingSessionId: trainingSessionId,
                                businessId: businessId,
                                conversationType: "include_exercise",
                                currentStep: "awaiting_selection",
                                state: {
                                    userInput: userInput,
                                    options: options,
                                    metadata: {
                                        createdAt: new Date().toISOString()
                                    }
                                }
                            })
                                .returning()];
                    case 1:
                        result = _b.sent();
                        return [2 /*return*/, ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.id) || ''];
                    case 2:
                        error_1 = _b.sent();
                        logger.error("Error creating conversation state", error_1);
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check if user has a pending disambiguation
     */
    ConversationStateService.getPendingDisambiguation = function (userId, trainingSessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var pending, state, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, client_1.db
                                .select()
                                .from(schema_1.conversationState)
                                .where((0, db_1.and)((0, db_1.eq)(schema_1.conversationState.userId, userId), (0, db_1.eq)(schema_1.conversationState.trainingSessionId, trainingSessionId), (0, db_1.eq)(schema_1.conversationState.conversationType, "include_exercise"), (0, db_1.eq)(schema_1.conversationState.currentStep, "awaiting_selection")))
                                .orderBy((0, db_1.desc)(schema_1.conversationState.createdAt))
                                .limit(1)];
                    case 1:
                        pending = (_a.sent())[0];
                        if (!pending) {
                            return [2 /*return*/, null];
                        }
                        state = pending.state;
                        return [2 /*return*/, {
                                id: pending.id,
                                userInput: state.userInput,
                                options: state.options || [],
                                state: pending.state
                            }];
                    case 2:
                        error_2 = _a.sent();
                        logger.error("Error getting pending disambiguation", error_2);
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Process user's selection from disambiguation options
     */
    ConversationStateService.processSelection = function (conversationId, selectedIndices) {
        return __awaiter(this, void 0, void 0, function () {
            var conversation, state, options_1, selectedExercises, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, client_1.db
                                .select()
                                .from(schema_1.conversationState)
                                .where((0, db_1.eq)(schema_1.conversationState.id, conversationId))
                                .limit(1)];
                    case 1:
                        conversation = (_a.sent())[0];
                        if (!conversation) {
                            throw new Error("Conversation not found");
                        }
                        state = conversation.state;
                        options_1 = state.options || [];
                        selectedExercises = selectedIndices
                            .map(function (idx) { return options_1[idx - 1]; })
                            .filter(Boolean);
                        // Update conversation state to completed
                        return [4 /*yield*/, client_1.db
                                .update(schema_1.conversationState)
                                .set({
                                currentStep: "completed",
                                state: __assign(__assign({}, state), { selections: selectedExercises.map(function (ex) { return ex.name; }), completedAt: new Date().toISOString() }),
                                updatedAt: new Date()
                            })
                                .where((0, db_1.eq)(schema_1.conversationState.id, conversationId))];
                    case 2:
                        // Update conversation state to completed
                        _a.sent();
                        logger.info("Processed selection", {
                            conversationId: conversationId,
                            selectedCount: selectedExercises.length
                        });
                        return [2 /*return*/, selectedExercises];
                    case 3:
                        error_3 = _a.sent();
                        logger.error("Error processing selection", error_3);
                        throw error_3;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update the clarification attempts count for a disambiguation
     */
    ConversationStateService.updateDisambiguationAttempts = function (stateId, attempts) {
        return __awaiter(this, void 0, void 0, function () {
            var error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, client_1.db
                                .update(schema_1.conversationState)
                                .set({
                                state: (0, db_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n            jsonb_set(\n              jsonb_set(\n                ", ",\n                '{metadata}',\n                COALESCE(", "->'metadata', '{}')::jsonb,\n                true\n              ),\n              '{metadata,clarificationAttempts}',\n              ", "::jsonb\n            )\n          "], ["\n            jsonb_set(\n              jsonb_set(\n                ", ",\n                '{metadata}',\n                COALESCE(", "->'metadata', '{}')::jsonb,\n                true\n              ),\n              '{metadata,clarificationAttempts}',\n              ", "::jsonb\n            )\n          "])), schema_1.conversationState.state, schema_1.conversationState.state, attempts),
                                updatedAt: new Date()
                            })
                                .where((0, db_1.eq)(schema_1.conversationState.id, stateId))];
                    case 1:
                        _a.sent();
                        logger.info("Updated clarification attempts", { stateId: stateId, attempts: attempts });
                        return [3 /*break*/, 3];
                    case 2:
                        error_4 = _a.sent();
                        logger.error("Error updating clarification attempts", error_4);
                        throw error_4;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Clean up old conversation states (for maintenance)
     */
    ConversationStateService.cleanupOldStates = function () {
        return __awaiter(this, arguments, void 0, function (daysOld) {
            var cutoffDate, result, error_5;
            if (daysOld === void 0) { daysOld = 7; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
                        return [4 /*yield*/, client_1.db
                                .delete(schema_1.conversationState)
                                .where((0, db_1.and)((0, db_1.eq)(schema_1.conversationState.currentStep, "completed")))];
                    case 1:
                        result = _a.sent();
                        logger.info("Cleaned up old conversation states");
                        return [2 /*return*/, 0]; // Return count when implemented
                    case 2:
                        error_5 = _a.sent();
                        logger.error("Error cleaning up old states", error_5);
                        return [2 /*return*/, 0];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return ConversationStateService;
}());
exports.ConversationStateService = ConversationStateService;
var templateObject_1;
