import type { TRPCRouterRecord } from "@trpc/server";

import { protectedProcedure, publicProcedure } from "../trpc";

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),
  getSecretMessage: protectedProcedure.query(() => {
    return "you can see this secret message!";
  }),
  getServerTime: publicProcedure.query(async ({ ctx }) => {
    try {
      // Simple connectivity test - try to query the existing Post table
      const posts = await ctx.db.query.Post.findMany({
        limit: 1,
      });
      
      return {
        serverTime: new Date().toISOString(),
        message: "Database connection successful!",
        tableAccessible: true,
        postCount: posts.length,
      };
    } catch (error) {
      return {
        serverTime: new Date().toISOString(),
        message: "Database connection failed!",
        error: error instanceof Error ? error.message : String(error),
        tableAccessible: false,
      };
    }
  }),
  getDatabaseInfo: publicProcedure.query(async ({ ctx }) => {
    try {
      // Test database connectivity by accessing the Post table
      const posts = await ctx.db.query.Post.findMany({
        limit: 3,
      });

      return {
        message: "Database connectivity verified!",
        connected: true,
        postTableRows: posts.length,
        samplePosts: posts.map(p => ({ id: p.id, title: p.title })),
        testTimestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        message: "Database connectivity failed!",
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        testTimestamp: new Date().toISOString(),
      };
    }
  }),
} satisfies TRPCRouterRecord;
