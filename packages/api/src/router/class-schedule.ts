import type { TRPCRouterRecord } from "@trpc/server";

import { asc, eq } from "@acme/db";
import { ClassSchedule } from "@acme/db/schema";

import type { SessionUser } from "../types/auth";
import { protectedProcedure } from "../trpc";

export const classScheduleRouter = {
  list: protectedProcedure.query(async ({ ctx }) => {
    const currentUser = ctx.session?.user as SessionUser;
    const businessId = currentUser.businessId;
    if (!businessId) {
      throw new Error("User must be associated with a business");
    }

    return ctx.db
      .select({
        id: ClassSchedule.id,
        name: ClassSchedule.name,
        dayOfWeek: ClassSchedule.dayOfWeek,
        startTime: ClassSchedule.startTime,
      })
      .from(ClassSchedule)
      .where(eq(ClassSchedule.businessId, businessId))
      .orderBy(asc(ClassSchedule.dayOfWeek), asc(ClassSchedule.startTime));
  }),
} satisfies TRPCRouterRecord;
