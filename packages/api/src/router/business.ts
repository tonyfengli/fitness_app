import { z } from "zod";

import { eq } from "@acme/db";
import { Business, CreateBusinessSchema } from "@acme/db/schema";

import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import type { SessionUser } from "../types/auth";

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
      if (user?.role !== 'trainer') {
        throw new Error('Only trainers can create businesses');
      }
      return ctx.db.insert(Business).values(input).returning();
    }),
});