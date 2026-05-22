import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq, gte, lte, sql } from "@acme/db";
import { ClassAttendance, ClassSchedule, UserTrainingPackage, user } from "@acme/db/schema";

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

  // Aggregated per-week attendance stats for the Sessions performance tab.
  // Returns one row per week (only weeks with at least one attendance), with:
  //   - total: total attendance count that week
  //   - activeClientCount: # of clients whose package date range overlapped the week
  //   - bySlot: per-class_schedule_id attendance counts that week
  weeklyStats: protectedProcedure.query(async ({ ctx }) => {
    const currentUser = ctx.session?.user as SessionUser;
    if (currentUser?.role !== "trainer") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only trainers can view weekly stats",
      });
    }
    const businessId = currentUser.businessId;
    if (!businessId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "User must be associated with a business",
      });
    }

    // 1. Per-week, per-slot attendance counts. date_trunc('week', date)::date
    //    returns the Monday of the ISO week — matches our Mon-based convention.
    const rows = await ctx.db
      .select({
        weekStart: sql<string>`date_trunc('week', ${ClassAttendance.date})::date`.as("week_start"),
        classScheduleId: ClassAttendance.classScheduleId,
        cnt: sql<number>`count(*)::int`.as("cnt"),
      })
      .from(ClassAttendance)
      .innerJoin(
        ClassSchedule,
        eq(ClassAttendance.classScheduleId, ClassSchedule.id),
      )
      .where(eq(ClassSchedule.businessId, businessId))
      .groupBy(
        sql`date_trunc('week', ${ClassAttendance.date})`,
        ClassAttendance.classScheduleId,
      )
      .orderBy(sql`date_trunc('week', ${ClassAttendance.date}) DESC`);

    // 2. All training package date ranges for this business so we can compute
    //    the active-package count per week. We include rows regardless of
    //    current status — what matters is whether the date range overlapped.
    const packages = await ctx.db
      .select({
        userId: UserTrainingPackage.userId,
        startDate: UserTrainingPackage.startDate,
        endDate: UserTrainingPackage.endDate,
      })
      .from(UserTrainingPackage)
      .innerJoin(user, eq(UserTrainingPackage.userId, user.id))
      .where(eq(user.businessId, businessId));

    // 3. Roll up into the wide-table shape, in JS for clarity.
    const weekMap = new Map<
      string,
      { total: number; bySlot: Record<string, number> }
    >();
    for (const row of rows) {
      const week = row.weekStart;
      const cnt = Number(row.cnt);
      const entry = weekMap.get(week) ?? { total: 0, bySlot: {} };
      entry.total += cnt;
      entry.bySlot[row.classScheduleId] =
        (entry.bySlot[row.classScheduleId] ?? 0) + cnt;
      weekMap.set(week, entry);
    }

    // Compute active-package counts per week.
    const result = Array.from(weekMap.entries()).map(([weekStart, data]) => {
      // Compute the inclusive week range (Mon → Sun) as date strings for
      // overlap comparisons against the YYYY-MM-DD package columns.
      const start = new Date(weekStart + "T00:00:00Z");
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      const startStr = weekStart;
      const endStr = end.toISOString().slice(0, 10);

      const activeUsers = new Set<string>();
      for (const pkg of packages) {
        if (pkg.startDate <= endStr && pkg.endDate >= startStr) {
          activeUsers.add(pkg.userId);
        }
      }

      return {
        weekStart,
        total: data.total,
        activeClientCount: activeUsers.size,
        bySlot: data.bySlot,
      };
    });

    result.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
    return result;
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
