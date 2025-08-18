import { TRPCError } from "@trpc/server";

import type { Context } from "../trpc";
import type { SessionUser } from "../types/auth";

/**
 * Extract and validate session user from context
 * @throws TRPCError if user is not authenticated
 */
export function getSessionUser(ctx: Context): SessionUser {
  const user = ctx.session?.user as SessionUser | undefined;

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action",
    });
  }

  return user;
}

/**
 * Extract session user and verify business context
 * @throws TRPCError if user is not authenticated or not in a business
 */
export function getSessionUserWithBusiness(
  ctx: Context,
): SessionUser & { businessId: string } {
  const user = getSessionUser(ctx);

  if (!user.businessId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "User must be associated with a business",
    });
  }

  return user as SessionUser & { businessId: string };
}

/**
 * Extract session user and verify trainer role
 * @throws TRPCError if user is not authenticated or not a trainer
 */
export function getTrainerUser(
  ctx: Context,
): SessionUser & { role: "trainer"; businessId: string } {
  const user = getSessionUserWithBusiness(ctx);

  if (user.role !== "trainer") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only trainers can perform this action",
    });
  }

  return user as SessionUser & { role: "trainer"; businessId: string };
}
