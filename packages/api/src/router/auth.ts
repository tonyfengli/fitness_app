import type { TRPCRouterRecord } from "@trpc/server";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";

import { and, eq, sql } from "@acme/db";
import { account, user, UserProfile, UserExerciseRatings } from "@acme/db/schema";

import type { SessionUser } from "../types/auth";
import { normalizePhoneNumber } from "../services/twilio";
import { protectedProcedure, publicProcedure } from "../trpc";

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
      role: user.role || "client",
      businessId: user.businessId,
    };
  }),
  isTrainer: protectedProcedure.query(({ ctx }) => {
    const user = ctx.session?.user as SessionUser;
    return user?.role === "trainer";
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
    if (currentUser?.role !== "trainer") {
      throw new Error("Only trainers can view all clients");
    }

    const businessId = currentUser.businessId;
    if (!businessId) {
      throw new Error("Trainer must be associated with a business");
    }

    // Fetch all users with role 'client' in the same business with their profiles
    const clients = await ctx.db.query.user.findMany({
      where: and(eq(user.businessId, businessId), eq(user.role, "client")),
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
        },
      },
      orderBy: (user, { asc }) => [asc(user.name)],
    });

    // Transform the data to have a single profile object
    return clients.map((client) => ({
      ...client,
      profile: client.userProfiles?.[0] || null,
      userProfiles: undefined, // Remove the array
    }));
  }),
  getClientExerciseRatingsCount: protectedProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user as SessionUser;
      if (currentUser?.role !== "trainer") {
        throw new Error("Only trainers can view client ratings");
      }

      const count = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(UserExerciseRatings)
        .where(eq(UserExerciseRatings.userId, input.clientId))
        .then((result) => result[0]?.count ?? 0);

      return { count };
    }),
  getAllUsersByBusiness: protectedProcedure.query(async ({ ctx }) => {
    // Only trainers should be able to see all users
    const currentUser = ctx.session?.user as SessionUser;
    if (currentUser?.role !== "trainer") {
      throw new Error("Only trainers can view all users");
    }

    const businessId = currentUser.businessId;
    if (!businessId) {
      throw new Error("Trainer must be associated with a business");
    }

    // Fetch all users in the same business
    const users = await ctx.db.query.user.findMany({
      where: eq(user.businessId, businessId),
      columns: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
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
        },
      },
      orderBy: (user, { asc }) => [asc(user.name)],
    });

    // Transform the data to have a single profile object
    return users.map((u) => ({
      ...u,
      profile: u.userProfiles?.[0] || null,
      userProfiles: undefined, // Remove the array
    }));
  }),
  updateClientProfile: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        strengthLevel: z.enum(["very_low", "low", "moderate", "high"]),
        skillLevel: z.enum(["very_low", "low", "moderate", "high"]),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Only trainers can update client profiles
      const currentUser = ctx.session?.user as SessionUser;
      if (currentUser?.role !== "trainer") {
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
          eq(user.role, "client"),
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
  createUserProfile: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        businessId: z.string().uuid(),
        strengthLevel: z.enum(["very_low", "low", "moderate", "high"]),
        skillLevel: z.enum(["very_low", "low", "moderate", "high"]),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if the user creating the profile is the same user or a trainer
      const currentUser = ctx.session?.user as SessionUser;
      const isOwnProfile = currentUser?.id === input.userId;
      const isTrainer = currentUser?.role === "trainer";

      if (!isOwnProfile && !isTrainer) {
        throw new Error(
          "You can only create your own profile or a trainer can create client profiles",
        );
      }

      // Check if profile already exists
      const existingProfile = await ctx.db.query.UserProfile.findFirst({
        where: eq(UserProfile.userId, input.userId),
      });

      if (existingProfile) {
        throw new Error("User profile already exists");
      }

      // Create new profile
      await ctx.db.insert(UserProfile).values({
        userId: input.userId,
        businessId: input.businessId,
        strengthLevel: input.strengthLevel,
        skillLevel: input.skillLevel,
        notes: input.notes,
      });

      return { success: true };
    }),
  createUserAsTrainer: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string(),
        phone: z.string().optional(),
        role: z.enum(["client", "trainer"]),
        strengthLevel: z
          .enum(["very_low", "low", "moderate", "high"])
          .optional(),
        skillLevel: z.enum(["very_low", "low", "moderate", "high"]).optional(),
        sourceClientId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Only trainers can create users
      const currentUser = ctx.session?.user as SessionUser;
      if (currentUser?.role !== "trainer") {
        throw new Error("Only trainers can create users");
      }

      const businessId = currentUser.businessId;
      if (!businessId) {
        throw new Error("Trainer must be associated with a business");
      }

      // Check if user already exists
      const existingUser = await ctx.db.query.user.findFirst({
        where: eq(user.email, input.email),
      });

      if (existingUser) {
        throw new Error("User with this email already exists");
      }

      // Hash the password
      const hashedPassword = await hashPassword(input.password);

      // Generate a unique user ID
      const userId = crypto.randomUUID();
      const now = new Date();

      // Normalize phone number if provided
      const normalizedPhone = input.phone
        ? normalizePhoneNumber(input.phone)
        : null;

      // Create the user
      await ctx.db.insert(user).values({
        id: userId,
        email: input.email,
        name: input.name,
        phone: normalizedPhone,
        role: input.role,
        businessId: businessId,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      });

      // Create account record for authentication
      const accountId = crypto.randomUUID();
      await ctx.db.insert(account).values({
        id: accountId,
        userId: userId,
        providerId: "credential",
        accountId: input.email,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      });

      // Create user profile for clients
      if (input.role === "client" && input.strengthLevel && input.skillLevel) {
        await ctx.db.insert(UserProfile).values({
          userId: userId,
          businessId: businessId,
          strengthLevel: input.strengthLevel,
          skillLevel: input.skillLevel,
        });
      }

      // Copy exercise ratings if sourceClientId is provided
      let copiedRatingsCount = 0;
      if (input.sourceClientId && input.role === "client") {
        try {
          // Fetch all exercise ratings from source client
          const sourceRatings = await ctx.db.query.UserExerciseRatings.findMany({
            where: eq(UserExerciseRatings.userId, input.sourceClientId),
          });

          if (sourceRatings.length > 0) {
            // Prepare the ratings for the new user
            const newRatings = sourceRatings.map((rating) => ({
              userId: userId,
              exerciseId: rating.exerciseId,
              businessId: rating.businessId,
              ratingType: rating.ratingType,
              createdAt: now,
              updatedAt: now,
            }));

            // Insert all ratings in batch
            await ctx.db.insert(UserExerciseRatings).values(newRatings);
            copiedRatingsCount = newRatings.length;
          }
        } catch (error) {
          console.error("Failed to copy exercise ratings:", error);
          // Don't fail the user creation if ratings copy fails
        }
      }

      return {
        success: true,
        userId: userId,
        copiedRatingsCount: copiedRatingsCount,
      };
    }),
} satisfies TRPCRouterRecord;
