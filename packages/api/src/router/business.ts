import { z } from "zod";

import { eq } from "@acme/db";
import { Business, CreateBusinessSchema } from "@acme/db/schema";

import { createTRPCRouter, publicProcedure } from "../trpc";

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

  create: publicProcedure
    .input(CreateBusinessSchema)
    .mutation(({ ctx, input }) => {
      return ctx.db.insert(Business).values(input).returning();
    }),
});