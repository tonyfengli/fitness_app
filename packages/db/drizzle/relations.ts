import { relations } from "drizzle-orm/relations";

import {
  account,
  business,
  businessExercise,
  exercises,
  session,
  user,
  userProfile,
} from "./schema";

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  accounts: many(account),
  sessions: many(session),
  business: one(business, {
    fields: [user.businessId],
    references: [business.id],
  }),
  userProfiles: many(userProfile),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const businessRelations = relations(business, ({ many }) => ({
  users: many(user),
  businessExercises: many(businessExercise),
  userProfiles: many(userProfile),
}));

export const businessExerciseRelations = relations(
  businessExercise,
  ({ one }) => ({
    business: one(business, {
      fields: [businessExercise.businessId],
      references: [business.id],
    }),
    exercise: one(exercises, {
      fields: [businessExercise.exerciseId],
      references: [exercises.id],
    }),
  }),
);

export const exercisesRelations = relations(exercises, ({ many }) => ({
  businessExercises: many(businessExercise),
}));

export const userProfileRelations = relations(userProfile, ({ one }) => ({
  business: one(business, {
    fields: [userProfile.businessId],
    references: [business.id],
  }),
  user: one(user, {
    fields: [userProfile.userId],
    references: [user.id],
  }),
}));
