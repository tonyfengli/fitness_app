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
exports.groupWorkoutTestDataLogger = exports.GroupWorkoutTestDataLogger = void 0;
var fs_1 = require("fs");
var path_1 = require("path");
var logger_1 = require("./logger");
var logger = (0, logger_1.createLogger)('GroupWorkoutTestDataLogger');
/**
 * Main logger class - splits data into focused files
 */
var GroupWorkoutTestDataLogger = /** @class */ (function () {
    function GroupWorkoutTestDataLogger() {
        this.enabled = true;
        this.sessionData = new Map();
        this.enabled = process.env.NODE_ENV !== 'production';
    }
    GroupWorkoutTestDataLogger.prototype.isEnabled = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.enabled];
            });
        });
    };
    /**
     * Initialize a new session
     */
    GroupWorkoutTestDataLogger.prototype.initSession = function (sessionId, groupContext) {
        if (!this.enabled)
            return;
        this.sessionData.set(sessionId, {
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
            groupContext: this.extractGroupContext(groupContext),
            phases: {},
            timing: {},
            errors: [],
            warnings: []
        });
    };
    /**
     * Extract essential group context data
     */
    GroupWorkoutTestDataLogger.prototype.extractGroupContext = function (context) {
        return {
            sessionId: context.sessionId,
            businessId: context.businessId,
            templateType: context.templateType,
            clients: context.clients.map(function (c) { return ({
                id: c.user_id,
                name: c.name,
                strengthCapacity: c.strength_capacity,
                skillCapacity: c.skill_capacity,
                intensity: c.intensity,
                primaryGoal: c.primary_goal
            }); })
        };
    };
    /**
     * Log Phase 1 & 2: Individual client processing
     */
    GroupWorkoutTestDataLogger.prototype.logClientProcessing = function (sessionId, clientId, filtering, scoring) {
        var _this = this;
        if (!this.enabled)
            return;
        var session = this.sessionData.get(sessionId);
        if (!session)
            return;
        var client = session.groupContext.clients.find(function (c) { return c.id === clientId; });
        if (!client)
            return;
        if (!session.phases.clients) {
            session.phases.clients = [];
        }
        // Extract essential exercise data
        var essentialExercises = scoring.map(function (ex) { return _this.extractEssentialExercise(ex); });
        session.phases.clients.push({
            clientId: clientId,
            clientName: client.name,
            preferences: {
                intensity: client.intensity,
                muscleTargets: filtering.muscleTarget || [],
                muscleLessens: filtering.muscleLessen || [],
                includeExercises: filtering.includeExercises || [],
                avoidExercises: filtering.avoidExercises || [],
                avoidJoints: filtering.avoidJoints || []
            },
            filtering: filtering.stats || {},
            scoring: {
                topExercises: essentialExercises.slice(0, 10),
                includedExercises: essentialExercises.filter(function (ex) { var _a; return (_a = filtering.includeExercises) === null || _a === void 0 ? void 0 : _a.includes(ex.name); }),
                scoreDistribution: this.calculateScoreDistribution(essentialExercises)
            }
        });
    };
    /**
     * Extract essential exercise fields
     */
    GroupWorkoutTestDataLogger.prototype.extractEssentialExercise = function (exercise) {
        return {
            id: exercise.id,
            name: exercise.name,
            score: exercise.score,
            movementPattern: exercise.movementPattern,
            primaryMuscle: exercise.primaryMuscle,
            secondaryMuscles: exercise.secondaryMuscles,
            loadedJoints: exercise.loadedJoints,
            functionTags: exercise.functionTags,
            scoreBreakdown: exercise.scoreBreakdown
        };
    };
    /**
     * Log Phase 2.5: Group merge scoring (simplified)
     */
    GroupWorkoutTestDataLogger.prototype.logGroupExercisePools = function (sessionId, groupExercisePools) {
        var _this = this;
        if (!this.enabled)
            return;
        var session = this.sessionData.get(sessionId);
        if (!session)
            return;
        if (!session.phases.groupPools) {
            session.phases.groupPools = {};
        }
        // Store simplified group exercise pools
        for (var _i = 0, _a = Object.entries(groupExercisePools); _i < _a.length; _i++) {
            var _b = _a[_i], blockId = _b[0], exercises = _b[1];
            session.phases.groupPools[blockId] = {
                total: exercises.length,
                sharedByAll: exercises.filter(function (ex) {
                    return ex.clientsSharing.length === session.groupContext.clients.length;
                }).length,
                sharedBy2Plus: exercises.filter(function (ex) { return ex.clientsSharing.length >= 2; }).length,
                topShared: exercises
                    .filter(function (ex) { return ex.clientsSharing.length >= 2; })
                    .slice(0, 10)
                    .map(function (ex) { return _this.extractEssentialGroupExercise(ex, session); })
            };
        }
    };
    /**
     * Log Phase 3: Template organization and blueprint
     */
    GroupWorkoutTestDataLogger.prototype.logBlueprint = function (sessionId, blueprint, cohesionAnalysis, // Ignored - will be removed
    slotAllocationDetails) {
        var _this = this;
        if (!this.enabled)
            return;
        var session = this.sessionData.get(sessionId);
        if (!session)
            return;
        session.phases.blueprint = {
            blocks: blueprint.blocks.map(function (block) { return _this.extractBlockDebugData(block, session); }),
            validationWarnings: blueprint.validationWarnings || []
        };
    };
    /**
     * Extract block debug data
     */
    GroupWorkoutTestDataLogger.prototype.extractBlockDebugData = function (block, session) {
        var _this = this;
        return {
            blockId: block.blockId,
            blockName: block.blockConfig.name,
            config: {
                functionTags: block.blockConfig.functionTags,
                maxExercises: block.blockConfig.maxExercises,
                movementPatternFilter: block.blockConfig.movementPatternFilter
            },
            slots: block.slots,
            sharedCandidates: {
                total: block.sharedCandidates.exercises.length,
                topExercises: block.sharedCandidates.exercises
                    .slice(0, 10)
                    .map(function (ex) { return _this.extractEssentialGroupExercise(ex, session); })
            },
            individualCandidates: Object.entries(block.individualCandidates).map(function (_a) {
                var _b;
                var clientId = _a[0], data = _a[1];
                var client = session.groupContext.clients.find(function (c) { return c.id === clientId; });
                return {
                    clientId: clientId,
                    clientName: (client === null || client === void 0 ? void 0 : client.name) || clientId,
                    exerciseCount: data.exercises.length,
                    allExercises: data.exercises.map(function (ex) { return _this.extractEssentialExercise(ex); }),
                    totalFilteredCount: ((_b = data.allFilteredExercises) === null || _b === void 0 ? void 0 : _b.length) || data.exercises.length
                };
            })
        };
    };
    /**
     * Extract essential group exercise data
     */
    GroupWorkoutTestDataLogger.prototype.extractEssentialGroupExercise = function (exercise, session) {
        return __assign(__assign({}, this.extractEssentialExercise(exercise)), { groupScore: exercise.groupScore, clientsSharing: exercise.clientsSharing, clientScores: exercise.clientScores.map(function (cs) {
                var _a;
                return ({
                    clientId: cs.clientId,
                    clientName: ((_a = session.groupContext.clients.find(function (c) { return c.id === cs.clientId; })) === null || _a === void 0 ? void 0 : _a.name) || cs.clientId,
                    individualScore: cs.individualScore
                });
            }) });
    };
    /**
     * Calculate score distribution
     */
    GroupWorkoutTestDataLogger.prototype.calculateScoreDistribution = function (exercises) {
        var ranges = [
            { range: '0-2', count: 0 },
            { range: '2-4', count: 0 },
            { range: '4-6', count: 0 },
            { range: '6-8', count: 0 },
            { range: '8-10', count: 0 }
        ];
        exercises.forEach(function (ex) {
            if (ex.score < 2)
                ranges[0].count++;
            else if (ex.score < 4)
                ranges[1].count++;
            else if (ex.score < 6)
                ranges[2].count++;
            else if (ex.score < 8)
                ranges[3].count++;
            else
                ranges[4].count++;
        });
        return ranges.filter(function (r) { return r.count > 0; });
    };
    /**
     * Add timing information
     */
    GroupWorkoutTestDataLogger.prototype.updateTiming = function (sessionId, phase, durationMs) {
        if (!this.enabled)
            return;
        var session = this.sessionData.get(sessionId);
        if (!session)
            return;
        session.timing[phase] = durationMs;
    };
    /**
     * Add warning
     */
    GroupWorkoutTestDataLogger.prototype.addWarning = function (sessionId, warning) {
        if (!this.enabled)
            return;
        var session = this.sessionData.get(sessionId);
        if (!session)
            return;
        session.warnings.push(warning);
    };
    /**
     * Add error
     */
    GroupWorkoutTestDataLogger.prototype.addError = function (sessionId, error) {
        if (!this.enabled)
            return;
        var session = this.sessionData.get(sessionId);
        if (!session)
            return;
        session.errors.push(error);
    };
    /**
     * Save session data to multiple focused files
     */
    GroupWorkoutTestDataLogger.prototype.saveGroupWorkoutData = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var session, timestamp, baseDir, latestDir, error_1;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.enabled)
                            return [2 /*return*/];
                        session = this.sessionData.get(sessionId);
                        if (!session) {
                            logger.warn("No session data found for ".concat(sessionId));
                            return [2 /*return*/];
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 11, , 12]);
                        timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        baseDir = path_1.default.join(process.cwd(), 'session-test-data', 'group-workouts', sessionId);
                        // Create directory
                        return [4 /*yield*/, fs_1.promises.mkdir(baseDir, { recursive: true })];
                    case 2:
                        // Create directory
                        _c.sent();
                        // Save different aspects to separate files
                        // 1. Overview file - quick summary
                        return [4 /*yield*/, this.saveFile(path_1.default.join(baseDir, "1-overview.json"), {
                                sessionId: sessionId,
                                timestamp: session.timestamp,
                                templateType: session.groupContext.templateType,
                                groupSize: session.groupContext.clients.length,
                                clients: session.groupContext.clients.map(function (c) { return ({
                                    id: c.id,
                                    name: c.name,
                                    capacity: "".concat(c.strengthCapacity, "/").concat(c.skillCapacity)
                                }); }),
                                timing: session.timing,
                                warnings: session.warnings,
                                errors: session.errors,
                                summary: {
                                    totalBlocks: ((_a = session.phases.blueprint) === null || _a === void 0 ? void 0 : _a.blocks.length) || 0,
                                    totalSharedExercises: ((_b = session.phases.blueprint) === null || _b === void 0 ? void 0 : _b.blocks.reduce(function (sum, b) {
                                        return sum + b.sharedCandidates.topExercises.length;
                                    }, 0)) || 0
                                }
                            })];
                    case 3:
                        // Save different aspects to separate files
                        // 1. Overview file - quick summary
                        _c.sent();
                        if (!session.phases.clients) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.saveFile(path_1.default.join(baseDir, "2-clients.json"), session.phases.clients)];
                    case 4:
                        _c.sent();
                        _c.label = 5;
                    case 5:
                        if (!session.phases.groupPools) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.saveFile(path_1.default.join(baseDir, "3-group-pools.json"), session.phases.groupPools)];
                    case 6:
                        _c.sent();
                        _c.label = 7;
                    case 7:
                        if (!session.phases.blueprint) return [3 /*break*/, 9];
                        return [4 /*yield*/, this.saveFile(path_1.default.join(baseDir, "4-blueprint.json"), session.phases.blueprint)];
                    case 8:
                        _c.sent();
                        _c.label = 9;
                    case 9:
                        latestDir = path_1.default.join(process.cwd(), 'session-test-data', 'group-workouts');
                        return [4 /*yield*/, this.saveFile(path_1.default.join(latestDir, 'latest.json'), {
                                overview: {
                                    sessionId: sessionId,
                                    timestamp: session.timestamp,
                                    templateType: session.groupContext.templateType,
                                    files: [
                                        "".concat(sessionId, "/1-overview.json"),
                                        "".concat(sessionId, "/2-clients.json"),
                                        "".concat(sessionId, "/3-group-pools.json"),
                                        "".concat(sessionId, "/4-blueprint.json")
                                    ]
                                },
                                quickView: {
                                    clients: session.groupContext.clients.map(function (c) { return c.name; }),
                                    timing: session.timing,
                                    warnings: session.warnings.length,
                                    errors: session.errors.length
                                }
                            })];
                    case 10:
                        _c.sent();
                        logger.info("Group workout data saved to ".concat(baseDir));
                        // Clear session data from memory
                        this.sessionData.delete(sessionId);
                        return [3 /*break*/, 12];
                    case 11:
                        error_1 = _c.sent();
                        logger.error('Failed to save group workout data:', error_1);
                        return [3 /*break*/, 12];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Helper to save JSON file
     */
    GroupWorkoutTestDataLogger.prototype.saveFile = function (filepath, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fs_1.promises.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // Legacy methods for compatibility (simplified implementations)
    GroupWorkoutTestDataLogger.prototype.logPhase1Client = function (sessionId, clientId, data) {
        // Map to new method
        this.logClientProcessing(sessionId, clientId, data.filters, data.scored || []);
    };
    GroupWorkoutTestDataLogger.prototype.logPhase2Client = function (sessionId, clientId, data) {
        // Already handled in logClientProcessing
    };
    GroupWorkoutTestDataLogger.prototype.buildStructuredBlockData = function (blueprint, session) {
        // Legacy method - not needed anymore
        return [];
    };
    return GroupWorkoutTestDataLogger;
}());
exports.GroupWorkoutTestDataLogger = GroupWorkoutTestDataLogger;
// Export singleton instance
exports.groupWorkoutTestDataLogger = new GroupWorkoutTestDataLogger();
