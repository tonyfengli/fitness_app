import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { and, eq, gte, lte, ne, count, sql } from "@acme/db";
import { user, UserTrainingPackage, TrainingPackage, UserTrainingSession, TrainingSession } from "@acme/db/schema";

import type { SessionUser } from "../types/auth";
import { protectedProcedure } from "../trpc";

export const clientsRouter = {
  getClientAttendanceHistory: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { clientId, startDate, endDate } = input;

      // Only trainers should be able to see client attendance history
      const currentUser = ctx.session?.user as SessionUser;
      if (currentUser?.role !== "trainer") {
        throw new Error("Only trainers can view client attendance history");
      }

      const businessId = currentUser.businessId;
      if (!businessId) {
        throw new Error("Trainer must be associated with a business");
      }

      // Fetch all training sessions the client attended in the date range
      const attendanceHistory = await ctx.db
        .select({
          sessionId: TrainingSession.id,
          sessionName: TrainingSession.name,
          scheduledAt: TrainingSession.scheduledAt,
          status: UserTrainingSession.status,
          checkedInAt: UserTrainingSession.checkedInAt,
          sessionStatus: TrainingSession.status,
          templateType: TrainingSession.templateType,
        })
        .from(UserTrainingSession)
        .leftJoin(TrainingSession, eq(UserTrainingSession.trainingSessionId, TrainingSession.id))
        .where(
          and(
            eq(UserTrainingSession.userId, clientId),
            eq(TrainingSession.businessId, businessId),
            gte(TrainingSession.scheduledAt, new Date(startDate)),
            lte(TrainingSession.scheduledAt, new Date(endDate))
          )
        )
        .orderBy(TrainingSession.scheduledAt);

      return attendanceHistory;
    }),

  getClientsWithPackages: protectedProcedure
    .input(
      z.object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        weekCount: z.number().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { startDate, endDate, weekCount } = input;
    // Only trainers should be able to see all clients
    const currentUser = ctx.session?.user as SessionUser;
    if (currentUser?.role !== "trainer") {
      throw new Error("Only trainers can view all clients");
    }

    const businessId = currentUser.businessId;
    if (!businessId) {
      throw new Error("Trainer must be associated with a business");
    }

    // Fetch clients with their active training packages using raw SQL approach for now
    const clientsWithPackages = await ctx.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
        // Package info
        packageId: TrainingPackage.id,
        packageName: TrainingPackage.name,
        sessionsPerWeek: TrainingPackage.sessionsPerWeek,
        monthlyPrice: TrainingPackage.monthlyPrice,
        // Subscription info
        userPackageId: UserTrainingPackage.id,
        startDate: UserTrainingPackage.startDate,
        endDate: UserTrainingPackage.endDate,
        status: UserTrainingPackage.status,
      })
      .from(user)
      .leftJoin(
        UserTrainingPackage,
        and(
          eq(user.id, UserTrainingPackage.userId),
          eq(UserTrainingPackage.status, "active")
        )
      )
      .leftJoin(
        TrainingPackage,
        eq(UserTrainingPackage.trainingPackageId, TrainingPackage.id)
      )
      .where(
        and(
          eq(user.businessId, businessId),
          eq(user.role, "client")
        )
      )
      .orderBy(user.name);

    // Filter clients with packages and add attendance calculations
    const clientsWithPackagesOnly = clientsWithPackages.filter(client => 
      client.packageId !== null && 
      client.packageName !== null && 
      client.sessionsPerWeek !== null && 
      client.monthlyPrice !== null && 
      client.startDate !== null && 
      client.endDate !== null && 
      client.status !== null
    );

    const clientsWithAttendance = await Promise.all(
      clientsWithPackagesOnly.map(async (client) => {
        // Count sessions attended in date range (excluding 'no_show')
        const attendanceResult = await ctx.db
          .select({ count: count() })
          .from(UserTrainingSession)
          .leftJoin(TrainingSession, eq(UserTrainingSession.trainingSessionId, TrainingSession.id))
          .where(
            and(
              eq(UserTrainingSession.userId, client.id),
              ne(UserTrainingSession.status, 'no_show'),
              gte(TrainingSession.scheduledAt, new Date(startDate)),
              lte(TrainingSession.scheduledAt, new Date(endDate))
            )
          );

        const attendedSessions = attendanceResult[0]?.count ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const expectedSessions = client.sessionsPerWeek! * weekCount;
        const attendancePercentage = expectedSessions > 0 
          ? Math.round((attendedSessions / expectedSessions) * 100)
          : 0;

        return {
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          createdAt: client.createdAt,
          currentPackage: {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            id: client.packageId!,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            name: client.packageName!,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            sessionsPerWeek: client.sessionsPerWeek!,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            monthlyPrice: client.monthlyPrice!,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            startDate: client.startDate!,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            endDate: client.endDate!,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            status: client.status!,
          },
          attendance: {
            attendedSessions,
            expectedSessions,
            attendancePercentage,
          },
        };
      })
    );

    return clientsWithAttendance;
  }),
} satisfies TRPCRouterRecord;