"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBusinessSchema = exports.Business = void 0;
var drizzle_orm_1 = require("drizzle-orm");
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_zod_1 = require("drizzle-zod");
var v4_1 = require("zod/v4");
exports.Business = (0, pg_core_1.pgTable)("business", function (t) { return ({
    id: t.uuid().notNull().primaryKey().defaultRandom(),
    name: t.varchar({ length: 255 }).notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t
        .timestamp({ mode: "date", withTimezone: true })
        .$onUpdateFn(function () { return (0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["now()"], ["now()"]))); }),
}); });
exports.CreateBusinessSchema = (0, drizzle_zod_1.createInsertSchema)(exports.Business, {
    name: v4_1.z.string().min(1).max(255),
}).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
var templateObject_1;
