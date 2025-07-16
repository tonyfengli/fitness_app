import { TRPCError } from "@trpc/server";
import { and, eq } from "@acme/db";
import type { Database } from "@acme/db/client";
import { 
  BusinessExercise,
  exercises,
  user
} from "@acme/db/schema";
import type { SessionUser } from "../types/auth";

/**
 * Common validation utilities for the API
 */

/**
 * Verify user has required role
 */
export function requireTrainerRole(currentUser: SessionUser) {
  if (currentUser.role !== 'trainer') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only trainers can perform this action',
    });
  }
}

/**
 * Verify user has business context
 */
export function requireBusinessContext(currentUser: SessionUser): string {
  if (!currentUser.businessId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'User must be associated with a business',
    });
  }
  return currentUser.businessId;
}

/**
 * Verify a client belongs to the same business
 */
export async function verifyClientInBusiness(
  db: Database,
  clientId: string,
  businessId: string
) {
  const client = await db.query.user.findFirst({
    where: and(
      eq(user.id, clientId),
      eq(user.businessId, businessId)
    ),
  });

  if (!client) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Client not found in your business',
    });
  }

  return client;
}

/**
 * Verify exercises are available to business
 */
export async function verifyExercisesAvailable(
  db: Database,
  exerciseIds: string[],
  businessId: string
) {
  const availableExercises = await db
    .select({
      exerciseId: exercises.id,
    })
    .from(exercises)
    .innerJoin(BusinessExercise, eq(exercises.id, BusinessExercise.exerciseId))
    .where(and(
      eq(BusinessExercise.businessId, businessId)
    ));

  const availableIds = new Set(availableExercises.map(e => e.exerciseId));
  const unavailableIds = exerciseIds.filter(id => !availableIds.has(id));

  if (unavailableIds.length > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Some exercises are not available to your business: ${unavailableIds.join(', ')}`,
    });
  }

  return true;
}

/**
 * Standard validation error messages
 */
export const ValidationErrors = {
  NO_BUSINESS: 'User must be associated with a business',
  NOT_TRAINER: 'Only trainers can perform this action',
  CLIENT_NOT_FOUND: 'Client not found in your business',
  EXERCISE_NOT_AVAILABLE: 'Exercise not available to your business',
  WORKOUT_NOT_FOUND: 'Workout not found',
  SESSION_NOT_FOUND: 'Training session not found',
  UNAUTHORIZED: 'Unauthorized',
} as const;