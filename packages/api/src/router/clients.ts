import type { TRPCRouterRecord } from "@trpc/server";

import { and, eq } from "@acme/db";
import { user, UserTrainingPackage, TrainingPackage } from "@acme/db/schema";

import type { SessionUser } from "../types/auth";
import { protectedProcedure } from "../trpc";

export const clientsRouter = {
  getClientsWithPackages: protectedProcedure.query(async ({ ctx }) => {
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

    // Transform the data to match the expected structure
    return clientsWithPackages.map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      createdAt: client.createdAt,
      currentPackage: client.packageId ? {
        id: client.packageId,
        name: client.packageName!,
        sessionsPerWeek: client.sessionsPerWeek!,
        monthlyPrice: client.monthlyPrice!,
        startDate: client.startDate!,
        endDate: client.endDate!,
        status: client.status!,
      } : null,
    }));
  }),
} satisfies TRPCRouterRecord;