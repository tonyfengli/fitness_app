#!/usr/bin/env ts-node
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
exports.getClientBlockExercises = getClientBlockExercises;
exports.getClientBlockExercisesSimplified = getClientBlockExercisesSimplified;
exports.compareClientsInBlock = compareClientsInBlock;
exports.getClientAllBlocks = getClientAllBlocks;
var fs_1 = require("fs");
var path_1 = require("path");
/**
 * Load group workout data from file
 */
function loadGroupWorkoutData(filename) {
    return __awaiter(this, void 0, void 0, function () {
        var filepath, content;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    filepath = path_1.default.join(process.cwd(), 'session-test-data', 'group-workouts', filename);
                    return [4 /*yield*/, fs_1.promises.readFile(filepath, 'utf-8')];
                case 1:
                    content = _a.sent();
                    return [2 /*return*/, JSON.parse(content)];
            }
        });
    });
}
/**
 * Get all exercises for a specific client in a specific block
 */
function getClientBlockExercises(filename, clientName, blockId) {
    return __awaiter(this, void 0, void 0, function () {
        var data, block, _i, _a, _b, clientId, clientData;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, loadGroupWorkoutData(filename)];
                case 1:
                    data = _c.sent();
                    block = data.phaseB.blocks.find(function (b) { return b.blockId === blockId; });
                    if (!block) {
                        throw new Error("Block ".concat(blockId, " not found"));
                    }
                    for (_i = 0, _a = Object.entries(block.individualExercises); _i < _a.length; _i++) {
                        _b = _a[_i], clientId = _b[0], clientData = _b[1];
                        if (clientData.clientName === clientName) {
                            return [2 /*return*/, {
                                    clientName: clientName,
                                    blockId: blockId,
                                    totalCount: clientData.totalCount,
                                    exercises: clientData.exercises
                                }];
                        }
                    }
                    throw new Error("Client ".concat(clientName, " not found in block ").concat(blockId));
            }
        });
    });
}
/**
 * Get simplified exercise list (just names and scores)
 */
function getClientBlockExercisesSimplified(filename, clientName, blockId) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getClientBlockExercises(filename, clientName, blockId)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, {
                            clientName: clientName,
                            blockId: blockId,
                            totalCount: result.totalCount,
                            exercises: result.exercises.map(function (ex) { return ({
                                rank: ex.rank,
                                name: ex.exerciseName,
                                score: ex.individualScore,
                                selected: ex.isSelected
                            }); })
                        }];
            }
        });
    });
}
/**
 * Compare all clients' exercises in a specific block
 */
function compareClientsInBlock(filename, blockId) {
    return __awaiter(this, void 0, void 0, function () {
        var data, block, comparison, _i, _a, _b, clientId, clientData;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, loadGroupWorkoutData(filename)];
                case 1:
                    data = _c.sent();
                    block = data.phaseB.blocks.find(function (b) { return b.blockId === blockId; });
                    if (!block) {
                        throw new Error("Block ".concat(blockId, " not found"));
                    }
                    comparison = {
                        blockId: blockId,
                        blockName: block.blockName,
                        slotAllocation: block.slotAllocation,
                        sharedExercises: block.sharedExercises.map(function (ex) { return ({
                            name: ex.exerciseName,
                            groupScore: ex.groupScore,
                            sharedBy: ex.clientsSharing.length
                        }); }),
                        clientExercises: {}
                    };
                    for (_i = 0, _a = Object.entries(block.individualExercises); _i < _a.length; _i++) {
                        _b = _a[_i], clientId = _b[0], clientData = _b[1];
                        comparison.clientExercises[clientData.clientName] = {
                            totalCount: clientData.totalCount,
                            exercises: clientData.exercises.map(function (ex) { return ({
                                rank: ex.rank,
                                name: ex.exerciseName,
                                score: ex.individualScore,
                                selected: ex.isSelected
                            }); })
                        };
                    }
                    return [2 /*return*/, comparison];
            }
        });
    });
}
/**
 * Get all blocks summary for a client
 */
function getClientAllBlocks(filename, clientName) {
    return __awaiter(this, void 0, void 0, function () {
        var data, clientBlocks, _i, _a, block, _b, _c, _d, clientId, clientData;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, loadGroupWorkoutData(filename)];
                case 1:
                    data = _e.sent();
                    clientBlocks = [];
                    for (_i = 0, _a = data.phaseB.blocks; _i < _a.length; _i++) {
                        block = _a[_i];
                        for (_b = 0, _c = Object.entries(block.individualExercises); _b < _c.length; _b++) {
                            _d = _c[_b], clientId = _d[0], clientData = _d[1];
                            if (clientData.clientName === clientName) {
                                clientBlocks.push({
                                    blockId: block.blockId,
                                    blockName: block.blockName,
                                    exerciseCount: clientData.totalCount,
                                    selectedCount: clientData.exercises.filter(function (ex) { return ex.isSelected; }).length,
                                    scoreRange: {
                                        min: Math.min.apply(Math, clientData.exercises.map(function (ex) { return ex.individualScore; })),
                                        max: Math.max.apply(Math, clientData.exercises.map(function (ex) { return ex.individualScore; }))
                                    }
                                });
                                break;
                            }
                        }
                    }
                    return [2 /*return*/, {
                            clientName: clientName,
                            blocks: clientBlocks
                        }];
            }
        });
    });
}
// Example usage (uncomment to test)
// async function main() {
//   try {
//     // Get Curtis Yu's Block A exercises
//     const curtisBlockA = await getClientBlockExercisesSimplified('latest-group-workout.json', 'Curtis Yu', 'A');
//     console.log('Curtis Yu - Block A:');
//     console.log(JSON.stringify(curtisBlockA, null, 2));
//     
//     // Compare all clients in Block A
//     const blockAComparison = await compareClientsInBlock('latest-group-workout.json', 'A');
//     console.log('\nBlock A Comparison:');
//     console.log(JSON.stringify(blockAComparison, null, 2));
//     
//   } catch (error) {
//     console.error('Error:', error);
//   }
// }
// 
// main();
