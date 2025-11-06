import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq, gte, lte, ne, count, sql } from "@acme/db";
import { user, UserTrainingPackage, TrainingPackage, UserTrainingSession, TrainingSession, ChangeUserPackageSchema } from "@acme/db/schema";

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
      if (clientId === '4wnrsk1032vmhjxn5wl' || clientId === '4263bc69-f06c-4cf1-83ec-4756ea5bf94c') {
        console.log(`🔍 [Client ${clientId}] Attendance History Query:`, {
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

    // Fetch all clients
    const allClients = await ctx.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(
        and(
          eq(user.businessId, businessId),
          eq(user.role, "client")
        )
      )
      .orderBy(user.name);

    // For each client, fetch ALL their packages that overlap with the date range
    const clientsWithPackages = await Promise.all(
      allClients.map(async (client) => {
        // Fetch all packages for this user that overlap with the filter date range
        const userPackages = await ctx.db
          .select({
            packageId: TrainingPackage.id,
            packageName: TrainingPackage.name,
            sessionsPerWeek: TrainingPackage.sessionsPerWeek,
            monthlyPrice: TrainingPackage.monthlyPrice,
            userPackageId: UserTrainingPackage.id,
            startDate: UserTrainingPackage.startDate,
            endDate: UserTrainingPackage.endDate,
            status: UserTrainingPackage.status,
          })
          .from(UserTrainingPackage)
          .leftJoin(
            TrainingPackage,
            eq(UserTrainingPackage.trainingPackageId, TrainingPackage.id)
          )
          .where(
            and(
              eq(UserTrainingPackage.userId, client.id),
              eq(UserTrainingPackage.status, "active"),
              // Package overlaps with filter date range
              lte(UserTrainingPackage.startDate, endDate),
              gte(UserTrainingPackage.endDate, startDate)
            )
          )
          .orderBy(UserTrainingPackage.startDate);

        // If no packages, return null to filter out later
        if (userPackages.length === 0) {
          return null;
        }

        return {
          ...client,
          packages: userPackages
        };
      })
    );

    // Filter out clients without packages
    const clientsWithPackagesFiltered = clientsWithPackages.filter(
      (client): client is NonNullable<typeof client> => client !== null
    );

    // Calculate attendance for each client with their package transitions
    const clientsWithAttendance = await Promise.all(
      clientsWithPackagesFiltered.map(async (client) => {
        // Get all complete weeks in the filter date range
        const filterStart = new Date(startDate);
        const filterEnd = new Date(endDate);
        const allWeeksInRange = getCompleteWeeksInRange(getWeekStart(filterStart), getWeekEnd(filterEnd));
        
        // For each week, determine which package was active and calculate expected sessions
        let totalExpectedSessions = 0;
        const weekPackageMap = new Map<string, { packageId: string; sessionsPerWeek: number; packageName: string }>();
        
        for (const week of allWeeksInRange) {
          // Find which package was active during this week
          // A package is considered active for a week if it covers the entire week
          const activePackage = client.packages.find(pkg => {
            const pkgStart = new Date(pkg.startDate!);
            const pkgEnd = new Date(pkg.endDate!);
            return week.start >= pkgStart && week.end <= pkgEnd;
          });
          
          if (activePackage) {
            totalExpectedSessions += activePackage.sessionsPerWeek!;
            weekPackageMap.set(`${week.start.toISOString()}-${week.end.toISOString()}`, {
              packageId: activePackage.packageId!,
              sessionsPerWeek: activePackage.sessionsPerWeek!,
              packageName: activePackage.packageName!
            });
          }
        }
        
        // Calculate the overall effective date range for attendance counting
        // This is the union of all package periods within the filter range
        const allPackageStarts = client.packages.map(p => new Date(p.startDate!).getTime());
        const allPackageEnds = client.packages.map(p => new Date(p.endDate!).getTime());
        
        const overallEffectiveStart = new Date(Math.max(
          filterStart.getTime(),
          Math.min(...allPackageStarts)
        ));
        const overallEffectiveEnd = new Date(Math.min(
          filterEnd.getTime(),
          Math.max(...allPackageEnds)
        ));
        
        // Count sessions attended in the overall effective date range
        const attendanceResult = await ctx.db
          .select({ count: count() })
          .from(UserTrainingSession)
          .leftJoin(TrainingSession, eq(UserTrainingSession.trainingSessionId, TrainingSession.id))
          .where(
            and(
              eq(UserTrainingSession.userId, client.id),
              ne(UserTrainingSession.status, 'no_show'),
              gte(TrainingSession.scheduledAt, overallEffectiveStart),
              lte(TrainingSession.scheduledAt, overallEffectiveEnd)
            )
          );

        const attendedSessions = attendanceResult[0]?.count ?? 0;
        const attendancePercentage = totalExpectedSessions > 0 
          ? Math.round((attendedSessions / totalExpectedSessions) * 100)
          : 0;

        // Debug specific client - both the original debug client and the new one
        if (client.id === '4wnrsk1032vmhjxn5wl' || client.id === '4263bc69-f06c-4cf1-83ec-4756ea5bf94c') {
          console.log(`🔍 [Client ${client.id}] Backend calculation with PACKAGE TRANSITIONS:`, {
            clientName: client.name,
            clientId: client.id,
            numberOfPackagesInRange: client.packages.length,
            packages: client.packages.map(pkg => ({
              name: pkg.packageName,
              sessionsPerWeek: pkg.sessionsPerWeek,
              startDate: new Date(pkg.startDate!).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
              endDate: new Date(pkg.endDate!).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            })),
            filterDates: { 
              start: startDate, 
              end: endDate,
              startFormatted: new Date(startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
              endFormatted: new Date(endDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
            },
            weekByWeekBreakdown: allWeeksInRange.map((week, index) => {
              const weekKey = `${week.start.toISOString()}-${week.end.toISOString()}`;
              const packageInfo = weekPackageMap.get(weekKey);
              return {
                weekNumber: index + 1,
                start: week.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                end: week.end.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                activePackage: packageInfo ? packageInfo.packageName : 'NO PACKAGE',
                sessionsExpected: packageInfo ? packageInfo.sessionsPerWeek : 0,
                reason: packageInfo ? 'Package active for entire week' : 'No package covers entire week'
              };
            }),
            calculations: {
              attendedSessions,
              totalExpectedSessions,
              attendancePercentage,
              calculation: `${attendedSessions} attended / ${totalExpectedSessions} expected = ${attendancePercentage}%`
            },
            packageTransitions: (() => {
              const transitions = [];
              for (let i = 0; i < client.packages.length - 1; i++) {
                const current = client.packages[i];
                const next = client.packages[i + 1];
                if (current && next) {
                  transitions.push({
                    from: `${current.packageName} (${current.sessionsPerWeek}x)`,
                    to: `${next.packageName} (${next.sessionsPerWeek}x)`,
                    transitionDate: new Date(next.startDate!).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                    type: next.sessionsPerWeek! > current.sessionsPerWeek! ? 'UPGRADE' : 
                          next.sessionsPerWeek! < current.sessionsPerWeek! ? 'DOWNGRADE' : 'RENEWAL'
                  });
                }
              }
              return transitions;
            })()
          });
        }

        // For frontend compatibility, we need to return the "current" package
        // This will be the package active today, or the most recent package
        const today = new Date();
        const currentPackage = client.packages.find(pkg => {
          const start = new Date(pkg.startDate!);
          const end = new Date(pkg.endDate!);
          return today >= start && today <= end;
        }) || client.packages[client.packages.length - 1]; // Fallback to most recent

        return {
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          createdAt: client.createdAt,
          currentPackage: currentPackage ? {
            id: currentPackage.packageId!,
            name: currentPackage.packageName!,
            sessionsPerWeek: currentPackage.sessionsPerWeek!,
            monthlyPrice: currentPackage.monthlyPrice!,
            startDate: currentPackage.startDate!,
            endDate: currentPackage.endDate!,
            status: currentPackage.status!,
          } : null,
          attendance: {
            attendedSessions,
            expectedSessions: totalExpectedSessions,
            attendancePercentage,
          },
          // Additional data for package transitions
          allPackages: client.packages,
        };
      })
    );

    // Filter out any clients without current packages for backward compatibility
    return clientsWithAttendance.filter(client => client.currentPackage !== null);
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

    // Fetch clients with their most recent active training package
    // Use a subquery to get the most recent (latest start_date) active package per client
    const mostRecentPackageSubquery = ctx.db
      .select({
        userId: UserTrainingPackage.userId,
        maxStartDate: sql<string>`MAX(${UserTrainingPackage.startDate})`.as('max_start_date')
      })
      .from(UserTrainingPackage)
      .where(eq(UserTrainingPackage.status, "active"))
      .groupBy(UserTrainingPackage.userId)
      .as('most_recent_packages');

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
        mostRecentPackageSubquery,
        and(
          eq(UserTrainingPackage.userId, mostRecentPackageSubquery.userId),
          sql`${UserTrainingPackage.startDate} = ${mostRecentPackageSubquery.maxStartDate}`
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

  getClientsWithInactivePackages: protectedProcedure.query(async ({ ctx }) => {
    // Only trainers should be able to see all clients
    const currentUser = ctx.session?.user as SessionUser;
    if (currentUser?.role !== "trainer") {
      throw new Error("Only trainers can view clients with inactive packages");
    }

    const businessId = currentUser.businessId;
    if (!businessId) {
      throw new Error("Trainer must be associated with a business");
    }

    // Fetch clients with their most recent inactive training package
    // Use a subquery to get the most recent (latest start_date) inactive package per client
    const mostRecentInactivePackageSubquery = ctx.db
      .select({
        userId: UserTrainingPackage.userId,
        maxStartDate: sql<string>`MAX(${UserTrainingPackage.startDate})`.as('max_start_date')
      })
      .from(UserTrainingPackage)
      .where(eq(UserTrainingPackage.status, "inactive"))
      .groupBy(UserTrainingPackage.userId)
      .as('most_recent_inactive_packages');

    const clientsWithInactivePackages = await ctx.db
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
          eq(UserTrainingPackage.status, "inactive")
        )
      )
      .innerJoin(
        mostRecentInactivePackageSubquery,
        and(
          eq(UserTrainingPackage.userId, mostRecentInactivePackageSubquery.userId),
          sql`${UserTrainingPackage.startDate} = ${mostRecentInactivePackageSubquery.maxStartDate}`
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

    return clientsWithInactivePackages;
  }),

  changeUserPackage: protectedProcedure
    .input(ChangeUserPackageSchema)
    .mutation(async ({ ctx, input }) => {
      const { userId, newPackageId, transitionDate, newEndDate } = input;

      // Get current user and business
      const currentUser = ctx.session?.user as SessionUser;
      const businessId = currentUser.businessId;
      if (!businessId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User must be associated with a business",
        });
      }

      // Validate that the user belongs to the same business
      const userCheck = await ctx.db
        .select({ id: user.id })
        .from(user)
        .where(
          and(
            eq(user.id, userId),
            eq(user.businessId, businessId)
          )
        );

      if (userCheck.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found or does not belong to your business",
        });
      }

      // Validate that the new package exists and belongs to the business
      const packageCheck = await ctx.db
        .select({ id: TrainingPackage.id })
        .from(TrainingPackage)
        .where(
          and(
            eq(TrainingPackage.id, newPackageId),
            eq(TrainingPackage.businessId, businessId),
            eq(TrainingPackage.isActive, true)
          )
        );

      if (packageCheck.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Training package not found or not available for your business",
        });
      }

      // Use transaction to handle the package change atomically
      const result = await ctx.db.transaction(async (tx) => {
        // Find the current active package for the user
        const currentPackage = await tx
          .select({
            id: UserTrainingPackage.id,
            startDate: UserTrainingPackage.startDate,
            endDate: UserTrainingPackage.endDate,
            trainingPackageId: UserTrainingPackage.trainingPackageId,
          })
          .from(UserTrainingPackage)
          .where(
            and(
              eq(UserTrainingPackage.userId, userId),
              eq(UserTrainingPackage.status, "active")
            )
          );

        if (currentPackage.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No active package found for this client",
          });
        }

        const activePackage = currentPackage[0];
        if (!activePackage) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No active package found for this client",
          });
        }

        // Convert dates for comparison (database returns strings)
        const currentStartDate = new Date(activePackage.startDate as string);
        const currentEndDate = new Date(activePackage.endDate as string);

        // Validate transition date is not before current package start
        if (transitionDate < currentStartDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Transition date cannot be before the current package start date",
          });
        }

        // Validate transition date is not after current package end
        if (transitionDate > currentEndDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Transition date cannot be after the current package end date",
          });
        }

        // Update the current package end date to the transition date
        const [updatedCurrentPackage] = await tx
          .update(UserTrainingPackage)
          .set({
            endDate: transitionDate.toISOString().split('T')[0] as string, // Convert to YYYY-MM-DD format
            updatedAt: sql`now()`,
          })
          .where(eq(UserTrainingPackage.id, activePackage.id as string))
          .returning();

        // Create the new package starting from the transition date
        const [newPackage] = await tx
          .insert(UserTrainingPackage)
          .values({
            userId,
            trainingPackageId: newPackageId,
            startDate: transitionDate.toISOString().split('T')[0] as string, // Convert to YYYY-MM-DD format
            endDate: newEndDate.toISOString().split('T')[0] as string, // Convert to YYYY-MM-DD format
            status: "active" as const,
          })
          .returning();

        return {
          updatedCurrentPackage,
          newPackage,
        };
      });

      return {
        success: true,
        message: "Package changed successfully",
        data: result,
      };
    }),

  cancelUserPackage: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId } = input;

      // Get current user and business
      const currentUser = ctx.session?.user as SessionUser;
      const businessId = currentUser.businessId;
      if (!businessId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User must be associated with a business",
        });
      }

      // Validate that the user belongs to the same business
      const userCheck = await ctx.db
        .select({ id: user.id })
        .from(user)
        .where(
          and(
            eq(user.id, userId),
            eq(user.businessId, businessId),
            eq(user.role, "client")
          )
        )
        .limit(1);

      if (!userCheck.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Client not found or does not belong to your business",
        });
      }

      // Get all active packages for this user
      const activePackages = await ctx.db
        .select({
          id: UserTrainingPackage.id,
          startDate: UserTrainingPackage.startDate,
          endDate: UserTrainingPackage.endDate,
          trainingPackageId: UserTrainingPackage.trainingPackageId,
        })
        .from(UserTrainingPackage)
        .where(
          and(
            eq(UserTrainingPackage.userId, userId),
            eq(UserTrainingPackage.status, "active")
          )
        );

      if (!activePackages.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active packages found for this client",
        });
      }

      // Calculate end of current week (Sunday)
      const today = new Date();
      const endOfWeek = getWeekEnd(today);
      const endOfWeekString = endOfWeek.toISOString().split('T')[0] as string;

      // Update all active packages
      const packagesToUpdate = activePackages.filter(pkg => {
        const currentEndDate = new Date(pkg.endDate);
        // Only update if current end date is in the future
        return currentEndDate > endOfWeek;
      });

      const results = [];
      
      // Update packages that extend beyond this week
      if (packagesToUpdate.length > 0) {
        for (const pkg of packagesToUpdate) {
          const result = await ctx.db
            .update(UserTrainingPackage)
            .set({
              status: "inactive" as const,
              endDate: endOfWeekString,
              updatedAt: sql`now()`,
            })
            .where(eq(UserTrainingPackage.id, pkg.id))
            .returning();
          results.push(result[0]);
        }
      }

      // Set remaining active packages to inactive (those that already end this week or earlier)
      const packagesToInactivate = activePackages.filter(pkg => {
        const currentEndDate = new Date(pkg.endDate);
        return currentEndDate <= endOfWeek;
      });

      if (packagesToInactivate.length > 0) {
        for (const pkg of packagesToInactivate) {
          const result = await ctx.db
            .update(UserTrainingPackage)
            .set({
              status: "inactive" as const,
              updatedAt: sql`now()`,
            })
            .where(eq(UserTrainingPackage.id, pkg.id))
            .returning();
          results.push(result[0]);
        }
      }

      return {
        success: true,
        message: `Cancelled ${results.length} package(s) successfully`,
        data: {
          cancelledPackages: results,
          effectiveCancellationDate: endOfWeekString,
          totalPackagesCancelled: results.length,
        },
      };
    }),
} satisfies TRPCRouterRecord;