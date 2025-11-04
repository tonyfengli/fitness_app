import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { and, eq, gte, lte, ne, count, sql } from "@acme/db";
import { user, UserTrainingPackage, TrainingPackage, UserTrainingSession, TrainingSession } from "@acme/db/schema";

// Import week utility functions for package date alignment
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  d.setDate(diff);
  return d;
}

function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return weekEnd;
}

function getCompleteWeeksInRange(startDate: Date, endDate: Date): Array<{start: Date, end: Date}> {
  const weeks: Array<{start: Date, end: Date}> = [];
  const adjustedStart = getWeekStart(startDate);
  const adjustedEnd = getWeekEnd(endDate);
  
  let currentWeekStart = new Date(adjustedStart);
  
  while (currentWeekStart <= adjustedEnd) {
    const weekEnd = getWeekEnd(currentWeekStart);
    
    // Only include complete weeks that fall within our range
    if (weekEnd <= adjustedEnd) {
      weeks.push({
        start: new Date(currentWeekStart),
        end: weekEnd
      });
    }
    
    // Move to next week
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }
  
  return weeks;
}

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

      // Debug logging (uncomment if needed)
      // console.log('[Attendance History]', clientId, startDate, 'to', endDate);

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

      // Debug logging for specific client
      if (clientId === '4wnrsk1032vmhjxn5wl') {
        console.log('🔍 [Client 4wnrsk1032vmhjxn5wl] Attendance History Query:', {
          clientId,
          dateRange: { 
            startDate, 
            endDate,
            startFormatted: new Date(startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            endFormatted: new Date(endDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          },
          foundSessions: attendanceHistory.length
        });
        attendanceHistory.forEach((session, index) => {
          console.log(`📅 [Session ${index + 1}]`, {
            date: session.scheduledAt?.toISOString(),
            dateFormatted: session.scheduledAt?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            name: session.sessionName,
            status: session.status,
            sessionStatus: session.sessionStatus,
            withinRange: session.scheduledAt && 
              session.scheduledAt >= new Date(startDate) && 
              session.scheduledAt <= new Date(endDate)
          });
        });
      }

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
      const { startDate, endDate } = input;
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

    // Debug logging (uncomment if needed)
    // console.log('[Clients With Packages]', startDate, 'to', endDate, 'weeks:', weekCount);

    const clientsWithAttendance = await Promise.all(
      clientsWithPackagesOnly.map(async (client) => {
        // Calculate effective date range considering package start/end dates aligned to week boundaries
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const packageStart = new Date(client.startDate!);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const packageEnd = new Date(client.endDate!);
        
        // For effective calculations, we need to ensure we only count complete weeks
        // where the client actually had an active package
        
        // Calculate effective range (intersection of filter range and actual package range)
        // Don't week-align the package dates yet - use actual package dates for intersection
        const effectiveStartDate = new Date(Math.max(
          new Date(startDate).getTime(), 
          packageStart.getTime()
        ));
        const effectiveEndDate = new Date(Math.min(
          new Date(endDate).getTime(), 
          packageEnd.getTime()
        ));
        
        // Now align the effective range to week boundaries for complete week counting
        const weekAlignedEffectiveStart = getWeekStart(effectiveStartDate);
        const weekAlignedEffectiveEnd = getWeekEnd(effectiveEndDate);
        
        // Only count weeks where the entire week falls within the package period
        // This ensures we don't count weeks before the package started or after it ended
        
        // Generate all potential complete weeks in the effective range
        const potentialWeeks = getCompleteWeeksInRange(weekAlignedEffectiveStart, weekAlignedEffectiveEnd);
        
        // Filter to only count weeks where the package was active for the ENTIRE week
        const activeWeeks = potentialWeeks.filter(week => {
          return week.start >= packageStart && week.end <= packageEnd;
        });
        
        // Count sessions attended in effective date range (excluding 'no_show')
        const attendanceResult = await ctx.db
          .select({ count: count() })
          .from(UserTrainingSession)
          .leftJoin(TrainingSession, eq(UserTrainingSession.trainingSessionId, TrainingSession.id))
          .where(
            and(
              eq(UserTrainingSession.userId, client.id),
              ne(UserTrainingSession.status, 'no_show'),
              gte(TrainingSession.scheduledAt, effectiveStartDate),
              lte(TrainingSession.scheduledAt, effectiveEndDate)
            )
          );

        const attendedSessions = attendanceResult[0]?.count ?? 0;
        
        // Calculate expected sessions based on complete weeks where package was fully active
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const expectedSessions = client.sessionsPerWeek! * activeWeeks.length;
        const attendancePercentage = expectedSessions > 0 
          ? Math.round((attendedSessions / expectedSessions) * 100)
          : 0;

        // Debug specific client
        if (client.id === '4wnrsk1032vmhjxn5wl') {
          console.log('🔍 [Client 4wnrsk1032vmhjxn5wl] Backend calculation with package dates:', {
            clientName: client.name,
            clientId: client.id,
            packageDates: {
              original: { 
                start: packageStart.toISOString(), 
                end: packageEnd.toISOString(),
                startFormatted: packageStart.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                endFormatted: packageEnd.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
              },
              weekAligned: { 
                start: weekAlignedEffectiveStart.toISOString(), 
                end: weekAlignedEffectiveEnd.toISOString(),
                startFormatted: weekAlignedEffectiveStart.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                endFormatted: weekAlignedEffectiveEnd.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
              }
            },
            filterDates: { 
              start: startDate, 
              end: endDate,
              startFormatted: new Date(startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
              endFormatted: new Date(endDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            },
            effectiveDates: { 
              start: effectiveStartDate.toISOString(), 
              end: effectiveEndDate.toISOString(),
              startFormatted: effectiveStartDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
              endFormatted: effectiveEndDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            },
            calculations: {
              attendedSessions,
              activeWeeks: activeWeeks.length,
              potentialWeeks: potentialWeeks.length,
              expectedSessions,
              attendancePercentage,
              sessionsPerWeek: client.sessionsPerWeek,
              calculation: `${client.sessionsPerWeek} sessions/week × ${activeWeeks.length} active weeks = ${expectedSessions} expected sessions`,
              attendanceCalculation: `${attendedSessions} attended / ${expectedSessions} expected = ${attendancePercentage}%`
            },
            activeWeeksDetails: activeWeeks.map((week, index) => ({
              weekNumber: index + 1,
              start: week.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              end: week.end.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              packageActiveForFullWeek: week.start >= packageStart && week.end <= packageEnd
            })),
            potentialWeeksDetails: potentialWeeks.map((week, index) => ({
              weekNumber: index + 1,
              start: week.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              end: week.end.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              packageActiveForFullWeek: week.start >= packageStart && week.end <= packageEnd
            }))
          });
        }

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

  getClientsWithActivePackages: protectedProcedure.query(async ({ ctx }) => {
    // Only trainers should be able to see all clients
    const currentUser = ctx.session?.user as SessionUser;
    if (currentUser?.role !== "trainer") {
      throw new Error("Only trainers can view clients with active packages");
    }

    const businessId = currentUser.businessId;
    if (!businessId) {
      throw new Error("Trainer must be associated with a business");
    }

    // Fetch clients with their active training packages
    const clientsWithActivePackages = await ctx.db
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
      .innerJoin(
        UserTrainingPackage,
        and(
          eq(user.id, UserTrainingPackage.userId),
          eq(UserTrainingPackage.status, "active")
        )
      )
      .innerJoin(
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

    return clientsWithActivePackages;
  }),
} satisfies TRPCRouterRecord;