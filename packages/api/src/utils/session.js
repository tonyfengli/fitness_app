"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionUser = getSessionUser;
exports.getSessionUserWithBusiness = getSessionUserWithBusiness;
exports.getTrainerUser = getTrainerUser;
var server_1 = require("@trpc/server");
/**
 * Extract and validate session user from context
 * @throws TRPCError if user is not authenticated
 */
function getSessionUser(ctx) {
    var _a;
    var user = (_a = ctx.session) === null || _a === void 0 ? void 0 : _a.user;
    if (!user) {
        throw new server_1.TRPCError({
            code: 'UNAUTHORIZED',
            message: 'You must be logged in to perform this action',
        });
    }
    return user;
}
/**
 * Extract session user and verify business context
 * @throws TRPCError if user is not authenticated or not in a business
 */
function getSessionUserWithBusiness(ctx) {
    var user = getSessionUser(ctx);
    if (!user.businessId) {
        throw new server_1.TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'User must be associated with a business',
        });
    }
    return user;
}
/**
 * Extract session user and verify trainer role
 * @throws TRPCError if user is not authenticated or not a trainer
 */
function getTrainerUser(ctx) {
    var user = getSessionUserWithBusiness(ctx);
    if (user.role !== 'trainer') {
        throw new server_1.TRPCError({
            code: 'FORBIDDEN',
            message: 'Only trainers can perform this action',
        });
    }
    return user;
}
