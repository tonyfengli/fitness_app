"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userProfileRelations = exports.exercisesRelations = exports.businessExerciseRelations = exports.businessRelations = exports.sessionRelations = exports.userRelations = exports.accountRelations = void 0;
var relations_1 = require("drizzle-orm/relations");
var schema_1 = require("./schema");
exports.accountRelations = (0, relations_1.relations)(schema_1.account, function (_a) {
    var one = _a.one;
    return ({
        user: one(schema_1.user, {
            fields: [schema_1.account.userId],
            references: [schema_1.user.id]
        }),
    });
});
exports.userRelations = (0, relations_1.relations)(schema_1.user, function (_a) {
    var one = _a.one, many = _a.many;
    return ({
        accounts: many(schema_1.account),
        sessions: many(schema_1.session),
        business: one(schema_1.business, {
            fields: [schema_1.user.businessId],
            references: [schema_1.business.id]
        }),
        userProfiles: many(schema_1.userProfile),
    });
});
exports.sessionRelations = (0, relations_1.relations)(schema_1.session, function (_a) {
    var one = _a.one;
    return ({
        user: one(schema_1.user, {
            fields: [schema_1.session.userId],
            references: [schema_1.user.id]
        }),
    });
});
exports.businessRelations = (0, relations_1.relations)(schema_1.business, function (_a) {
    var many = _a.many;
    return ({
        users: many(schema_1.user),
        businessExercises: many(schema_1.businessExercise),
        userProfiles: many(schema_1.userProfile),
    });
});
exports.businessExerciseRelations = (0, relations_1.relations)(schema_1.businessExercise, function (_a) {
    var one = _a.one;
    return ({
        business: one(schema_1.business, {
            fields: [schema_1.businessExercise.businessId],
            references: [schema_1.business.id]
        }),
        exercise: one(schema_1.exercises, {
            fields: [schema_1.businessExercise.exerciseId],
            references: [schema_1.exercises.id]
        }),
    });
});
exports.exercisesRelations = (0, relations_1.relations)(schema_1.exercises, function (_a) {
    var many = _a.many;
    return ({
        businessExercises: many(schema_1.businessExercise),
    });
});
exports.userProfileRelations = (0, relations_1.relations)(schema_1.userProfile, function (_a) {
    var one = _a.one;
    return ({
        business: one(schema_1.business, {
            fields: [schema_1.userProfile.businessId],
            references: [schema_1.business.id]
        }),
        user: one(schema_1.user, {
            fields: [schema_1.userProfile.userId],
            references: [schema_1.user.id]
        }),
    });
});
