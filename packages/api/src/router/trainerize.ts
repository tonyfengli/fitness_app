import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import { syncTrainerizeEventsFromSheet } from "../services/trainerizeSheetSync";
import type { SessionUser } from "../types/auth";
import { protectedProcedure } from "../trpc";

export const trainerizeRouter = {
  // Manually trigger a sync from the Google Sheet → trainerize_event table.
  // Idempotent — runs again with no duplicate inserts thanks to the
  // external_event_key UNIQUE constraint.
  sync: protectedProcedure.mutation(async ({ ctx }) => {
    const currentUser = ctx.session?.user as SessionUser;
    if (currentUser?.role !== "trainer") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only trainers can sync Trainerize events",
      });
    }

    try {
      const result = await syncTrainerizeEventsFromSheet();
      return result;
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          err instanceof Error ? err.message : "Failed to sync from sheet",
      });
    }
  }),
} satisfies TRPCRouterRecord;
