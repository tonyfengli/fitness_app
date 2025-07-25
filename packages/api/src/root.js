"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appRouter = void 0;
var auth_1 = require("./router/auth");
var business_1 = require("./router/business");
var exercise_1 = require("./router/exercise");
var training_session_1 = require("./router/training-session");
var workout_1 = require("./router/workout");
var workout_preferences_1 = require("./router/workout-preferences");
var messages_1 = require("./routers/messages");
var trpc_1 = require("./trpc");
exports.appRouter = (0, trpc_1.createTRPCRouter)({
    auth: auth_1.authRouter,
    business: business_1.businessRouter,
    exercise: exercise_1.exerciseRouter,
    trainingSession: training_session_1.trainingSessionRouter,
    workout: workout_1.workoutRouter,
    workoutPreferences: workout_preferences_1.workoutPreferencesRouter,
    messages: messages_1.messagesRouter,
});
