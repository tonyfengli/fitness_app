import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { and, desc, eq, sql } from "@acme/db";
import { db } from "@acme/db/client";
import {
  messages,
  TrainingSession,
  user,
  UserTrainingSession,
} from "@acme/db/schema";

import { saveMessage } from "../services/messageService";
import { WebAdapter } from "../services/messaging/adapters/web-adapter";
import { MessagePipeline } from "../services/messaging/message-pipeline";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const messagesRouter = createTRPCRouter({
  // Get messages for a specific user (trainer view)
  getByUser: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1, "User ID is required"),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Check if the current user is a trainer for this business
      const trainer = await db
        .select()
        .from(user)
        .where(eq(user.id, ctx.session.user.id))
        .limit(1);

      if (!trainer.length || trainer[0]?.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can view messages",
        });
      }

      // Get the target user to ensure they're in the same business
      const targetUser = await db
        .select()
        .from(user)
        .where(eq(user.id, input.userId))
        .limit(1);

      if (
        !targetUser.length ||
        targetUser[0]?.businessId !== trainer[0].businessId
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Can only view messages for users in your business",
        });
      }

      // Get all messages for this user
      const userMessages = await db
        .select({
          id: messages.id,
          direction: messages.direction,
          content: messages.content,
          metadata: messages.metadata,
          status: messages.status,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.userId, input.userId))
        .orderBy(desc(messages.createdAt))
        .limit(100); // Limit to last 100 messages for performance

      return userMessages;
    }),

  // Get all users with messages for a business (trainer view)
  getUsersWithMessages: protectedProcedure.query(async ({ ctx }) => {
    // Check if the current user is a trainer
    const trainer = await db
      .select()
      .from(user)
      .where(eq(user.id, ctx.session.user.id))
      .limit(1);

    if (!trainer.length || trainer[0]?.role !== "trainer") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only trainers can view messages",
      });
    }

    const businessId = trainer[0].businessId;

    // Get distinct users who have messages
    const usersWithMessages = await db
      .selectDistinct({
        userId: messages.userId,
        userName: user.name,
        userPhone: user.phone,
        lastMessageAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(user, eq(messages.userId, user.id))
      .where(eq(messages.businessId, businessId))
      .orderBy(desc(messages.createdAt));

    // Group by user and get latest message time
    const uniqueUsers = usersWithMessages.reduce(
      (acc, curr) => {
        if (!acc[curr.userId]) {
          acc[curr.userId] = {
            userId: curr.userId,
            userName: curr.userName,
            userPhone: curr.userPhone,
            lastMessageAt: curr.lastMessageAt,
          };
        } else {
          // Keep the most recent message time
          if (
            curr.lastMessageAt &&
            (!acc[curr.userId].lastMessageAt ||
              curr.lastMessageAt > acc[curr.userId].lastMessageAt)
          ) {
            acc[curr.userId].lastMessageAt = curr.lastMessageAt;
          }
        }
        return acc;
      },
      {} as Record<string, any>,
    );

    return Object.values(uniqueUsers).sort(
      (a, b) =>
        (b.lastMessageAt?.getTime() || 0) - (a.lastMessageAt?.getTime() || 0),
    );
  }),

  // Send a message from the web app (simulating client messaging)
  sendMessage: protectedProcedure
    .input(
      z.object({
        recipientId: z.string().min(1, "Recipient ID is required"),
        content: z.string().min(1, "Message content is required"),
        trainingSessionId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the sender is a trainer
      const trainer = await db
        .select()
        .from(user)
        .where(eq(user.id, ctx.session.user.id))
        .limit(1);

      if (!trainer.length || trainer[0]?.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can send messages",
        });
      }

      // Get the recipient (client) to ensure they're in the same business
      const recipient = await db
        .select()
        .from(user)
        .where(eq(user.id, input.recipientId))
        .limit(1);

      if (
        !recipient.length ||
        recipient[0]?.businessId !== trainer[0].businessId
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Can only send messages to users in your business",
        });
      }

      const businessId = trainer[0].businessId;
      if (!businessId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Business ID not found",
        });
      }

      try {
        // Get active training session for the user if not provided
        let trainingSessionId = input.trainingSessionId;

        if (!trainingSessionId) {
          // Find active session for the user
          const activeSession = await db
            .select({
              sessionId: UserTrainingSession.trainingSessionId,
            })
            .from(UserTrainingSession)
            .innerJoin(
              TrainingSession,
              eq(UserTrainingSession.trainingSessionId, TrainingSession.id),
            )
            .where(
              and(
                eq(UserTrainingSession.userId, input.recipientId),
                eq(UserTrainingSession.status, "checked_in"),
                eq(TrainingSession.status, "open"),
              ),
            )
            .limit(1);

          if (activeSession.length > 0 && activeSession[0]) {
            trainingSessionId = activeSession[0].sessionId;
            console.log(
              `[${new Date().toISOString()}] Found active session for user:`,
              {
                userId: input.recipientId,
                sessionId: trainingSessionId,
              },
            );
          }
        }

        // Create unified message from web request
        const unifiedMessage = WebAdapter.fromWebRequest({
          recipientId: input.recipientId,
          content: input.content,
          businessId,
          trainingSessionId,
          sentBy: ctx.session.user.id,
          sentByName: trainer[0].name,
        });

        // Process through unified pipeline
        const pipeline = new MessagePipeline();
        const processed = await pipeline.process(unifiedMessage);

        return {
          success: processed.response.success,
          response: processed.response.message,
        };
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] Failed to process test message:`,
          error,
        );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process message",
        });
      }
    }),

  // Get message stats for debugging
  getStats: protectedProcedure
    .input(
      z.object({
        userId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Check if the current user is a trainer
      const trainer = await db
        .select()
        .from(user)
        .where(eq(user.id, ctx.session.user.id))
        .limit(1);

      if (!trainer.length || trainer[0]?.role !== "trainer") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only trainers can view message stats",
        });
      }

      const businessId = trainer[0].businessId;

      // Build where clause
      const whereClause = input.userId
        ? and(
            eq(messages.businessId, businessId),
            eq(messages.userId, input.userId),
          )
        : eq(messages.businessId, businessId);

      // Get message counts
      const stats = await db
        .select({
          totalMessages: sql<number>`count(${messages.id})`,
        })
        .from(messages)
        .where(whereClause);

      // Get breakdown by direction
      const byDirection = await db
        .select({
          direction: messages.direction,
          count: sql<number>`count(${messages.id})`,
        })
        .from(messages)
        .where(whereClause)
        .groupBy(messages.direction);

      // Get check-in success rate
      const checkInMessages = await db
        .select({
          metadata: messages.metadata,
        })
        .from(messages)
        .where(and(whereClause, eq(messages.direction, "outbound")));

      const checkInStats = checkInMessages.reduce(
        (acc, msg) => {
          const metadata = msg.metadata as any;
          if (metadata?.checkInResult !== undefined) {
            acc.total++;
            if (metadata.checkInResult.success) {
              acc.successful++;
            }
          }
          return acc;
        },
        { total: 0, successful: 0 },
      );

      return {
        totalMessages: stats[0]?.totalMessages || 0,
        byDirection: byDirection.reduce(
          (acc, curr) => {
            acc[curr.direction] = curr.count;
            return acc;
          },
          {} as Record<string, number>,
        ),
        checkInSuccessRate:
          checkInStats.total > 0
            ? (checkInStats.successful / checkInStats.total) * 100
            : 0,
        checkInTotal: checkInStats.total,
        checkInSuccessful: checkInStats.successful,
      };
    }),
});
