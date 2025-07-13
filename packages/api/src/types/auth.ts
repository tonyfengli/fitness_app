import type { user } from "@acme/db/schema";

// Extend the session user type to include our custom fields
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Custom fields
  role: typeof user.$inferSelect['role'];
  businessId: typeof user.$inferSelect['businessId'];
  phone?: typeof user.$inferSelect['phone'];
};