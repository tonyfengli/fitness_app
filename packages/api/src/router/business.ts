import { z } from "zod";

import { eq } from "@acme/db";
import { Business, CreateBusinessSchema, TrainingPackage } from "@acme/db/schema";

import type { SessionUser } from "../types/auth";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const businessRouter = createTRPCRouter({
  all: publicProcedure.query(async ({ ctx }) => {
    // Use direct select since Business might not be in the query object
    return await ctx.db.select().from(Business).orderBy(Business.name);
  }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(Business)
        .where(eq(Business.id, input.id))
        .limit(1);
      return result[0];
    }),

  create: protectedProcedure
    .input(CreateBusinessSchema)
    .mutation(({ ctx, input }) => {
      // Only trainers or admins should be able to create businesses
      const user = ctx.session?.user as SessionUser;
      if (user?.role !== "trainer") {
        throw new Error("Only trainers can create businesses");
      }
      return ctx.db.insert(Business).values(input).returning();
    }),

  getTrainingPackages: protectedProcedure.query(async ({ ctx }) => {
    const currentUser = ctx.session?.user as SessionUser;
    const businessId = currentUser.businessId;
    
    if (!businessId) {
      throw new Error("User must be associated with a business");
    }

    return await ctx.db
      .select({
        id: TrainingPackage.id,
        name: TrainingPackage.name,
        sessionsPerWeek: TrainingPackage.sessionsPerWeek,
        monthlyPrice: TrainingPackage.monthlyPrice,
        isActive: TrainingPackage.isActive,
      })
      .from(TrainingPackage)
      .where(eq(TrainingPackage.businessId, businessId))
      .orderBy(TrainingPackage.sessionsPerWeek);
  }),
});
