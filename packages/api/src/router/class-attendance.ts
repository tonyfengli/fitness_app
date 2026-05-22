import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq, gte, lte, sql } from "@acme/db";
import { ClassAttendance, ClassSchedule, user } from "@acme/db/schema";

import type { SessionUser } from "../types/auth";
import { protectedProcedure } from "../trpc";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export const classAttendanceRouter = {
  // Returns all attendance rows for the trainer's business within the given week.
  // Joined with user so the UI gets the client's name in one round-trip.
  byWeek: protectedProcedure
    .input(z.object({ weekStart: dateStringSchema }))
    .query(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user as SessionUser;
      const businessId = currentUser.businessId;
      if (!businessId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User must be associated with a business",
        });
      }

      const weekEndExpr = sql<string>`(${input.weekStart}::date + INTERVAL '6 days')::date`;

      return ctx.db
        .select({
          classScheduleId: ClassAttendance.classScheduleId,
          userId: ClassAttendance.userId,
          date: ClassAttendance.date,
          name: user.name,
        })
        .from(ClassAttendance)
        .innerJoin(
          ClassSchedule,
          eq(ClassAttendance.classScheduleId, ClassSchedule.id),
        )
        .innerJoin(user, eq(ClassAttendance.userId, user.id))
        .where(
          and(
            eq(ClassSchedule.businessId, businessId),
            gte(ClassAttendance.date, input.weekStart),
            lte(ClassAttendance.date, weekEndExpr),
          ),
        );
    }),

  // Mark a client as present at a specific class on a specific date.
  // Idempotent — if the row already exists, this is a no-op (UNIQUE constraint via onConflictDoNothing).
  mark: protectedProcedure
    .input(
      z.object({
        classScheduleId: z.string().uuid(),
        userId: z.string(),
        date: dateStringSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user as SessionUser;
      const businessId = currentUser.businessId;
      if (!businessId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User must be associated with a business",
        });
      }

      // Verify the schedule belongs to the trainer's business
      const scheduleCheck = await ctx.db
        .select({ id: ClassSchedule.id })
        .from(ClassSchedule)
        .where(
          and(
            eq(ClassSchedule.id, input.classScheduleId),
            eq(ClassSchedule.businessId, businessId),
          ),
        )
        .limit(1);
      if (scheduleCheck.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Schedule not found in your business",
        });
      }

      // Verify the client belongs to the trainer's business
      const clientCheck = await ctx.db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.id, input.userId), eq(user.businessId, businessId)))
        .limit(1);
      if (clientCheck.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found in your business",
        });
      }

      await ctx.db
        .insert(ClassAttendance)
        .values({
          classScheduleId: input.classScheduleId,
          userId: input.userId,
          date: input.date,
          status: "present",
        })
        .onConflictDoNothing();

      return { success: true };
    }),

  // Remove a client's attendance for a specific class on a specific date.
  unmark: protectedProcedure
    .input(
      z.object({
        classScheduleId: z.string().uuid(),
        userId: z.string(),
        date: dateStringSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user as SessionUser;
      const businessId = currentUser.businessId;
      if (!businessId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User must be associated with a business",
        });
      }

      // Verify the schedule belongs to the trainer's business
      const scheduleCheck = await ctx.db
        .select({ id: ClassSchedule.id })
        .from(ClassSchedule)
        .where(
          and(
            eq(ClassSchedule.id, input.classScheduleId),
            eq(ClassSchedule.businessId, businessId),
          ),
        )
        .limit(1);
      if (scheduleCheck.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Schedule not found in your business",
        });
      }

      await ctx.db
        .delete(ClassAttendance)
        .where(
          and(
            eq(ClassAttendance.classScheduleId, input.classScheduleId),
            eq(ClassAttendance.userId, input.userId),
            eq(ClassAttendance.date, input.date),
          ),
        );

      return { success: true };
    }),
} satisfies TRPCRouterRecord;
