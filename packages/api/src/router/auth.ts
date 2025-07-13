import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { eq, and } from "@acme/db";
import { user, UserProfile } from "@acme/db/schema";

import { protectedProcedure, publicProcedure } from "../trpc";
import type { SessionUser } from "../types/auth";

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),
  getSecretMessage: protectedProcedure.query(() => {
    return "you can see this secret message!";
  }),
  getUserRole: protectedProcedure.query(({ ctx }) => {
    if (!ctx.session?.user) {
      return null;
    }
    const user = ctx.session.user as SessionUser;
    return {
      role: user.role || 'client',
      businessId: user.businessId,
    };
  }),
  isTrainer: protectedProcedure.query(({ ctx }) => {
    const user = ctx.session?.user as SessionUser;
    return user?.role === 'trainer';
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
  updateUserBusiness: protectedProcedure
    .input(z.object({ businessId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session?.user?.id) {
        throw new Error("No user ID in session");
      }

      await ctx.db
        .update(user)
        .set({ businessId: input.businessId })
        .where(eq(user.id, ctx.session.user.id));

      return { success: true };
    }),
  getClientsByBusiness: protectedProcedure.query(async ({ ctx }) => {
    // Only trainers should be able to see all clients
    const currentUser = ctx.session?.user as SessionUser;
    if (currentUser?.role !== 'trainer') {
      throw new Error("Only trainers can view all clients");
    }

    const businessId = currentUser.businessId;
    if (!businessId) {
      throw new Error("Trainer must be associated with a business");
    }

    // Fetch all users with role 'client' in the same business with their profiles
    const clients = await ctx.db.query.user.findMany({
      where: and(
        eq(user.businessId, businessId),
        eq(user.role, 'client')
      ),
      columns: {
        id: true,
        email: true,
        phone: true,
        name: true,
        createdAt: true,
      },
      with: {
        userProfiles: {
          columns: {
            strengthLevel: true,
            skillLevel: true,
            notes: true,
          },
          limit: 1,
        }
      },
      orderBy: (user, { asc }) => [asc(user.name)],
    });

    // Transform the data to have a single profile object
    return clients.map(client => ({
      ...client,
      profile: client.userProfiles?.[0] || null,
      userProfiles: undefined, // Remove the array
    }));
  }),
  updateClientProfile: protectedProcedure
    .input(z.object({
      userId: z.string(),
      strengthLevel: z.enum(["very_low", "low", "moderate", "high"]),
      skillLevel: z.enum(["very_low", "low", "moderate", "high"]),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Only trainers can update client profiles
      const currentUser = ctx.session?.user as SessionUser;
      if (currentUser?.role !== 'trainer') {
        throw new Error("Only trainers can update client profiles");
      }

      const businessId = currentUser.businessId;
      if (!businessId) {
        throw new Error("Trainer must be associated with a business");
      }

      // Check if the client belongs to the trainer's business
      const client = await ctx.db.query.user.findFirst({
        where: and(
          eq(user.id, input.userId),
          eq(user.businessId, businessId),
          eq(user.role, 'client')
        ),
      });

      if (!client) {
        throw new Error("Client not found or not in your business");
      }

      // Check if profile exists
      const existingProfile = await ctx.db.query.UserProfile.findFirst({
        where: eq(UserProfile.userId, input.userId),
      });

      if (existingProfile) {
        // Update existing profile
        await ctx.db
          .update(UserProfile)
          .set({
            strengthLevel: input.strengthLevel,
            skillLevel: input.skillLevel,
            notes: input.notes,
          })
          .where(eq(UserProfile.userId, input.userId));
      } else {
        // Create new profile
        await ctx.db.insert(UserProfile).values({
          userId: input.userId,
          businessId: businessId,
          strengthLevel: input.strengthLevel,
          skillLevel: input.skillLevel,
          notes: input.notes,
        });
      }

      return { success: true };
    }),
} satisfies TRPCRouterRecord;
