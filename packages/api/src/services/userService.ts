import { eq } from "@acme/db";
import { db } from "@acme/db/client";
import { user } from "@acme/db/schema";

import { createLogger } from "../utils/logger";
import { normalizePhoneNumber } from "./twilio";

const logger = createLogger("UserService");

export async function getUserByPhone(phoneNumber: string) {
  try {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Try multiple formats like in checkInService
    let foundUser = await db
      .select({
        userId: user.id,
        businessId: user.businessId,
        name: user.name,
        phone: user.phone,
      })
      .from(user)
      .where(eq(user.phone, normalizedPhone))
      .limit(1);

    // If not found, try without country code
    if (!foundUser.length && normalizedPhone.startsWith("+1")) {
      const phoneWithoutCountry = normalizedPhone.substring(2);

      foundUser = await db
        .select({
          userId: user.id,
          businessId: user.businessId,
          name: user.name,
          phone: user.phone,
        })
        .from(user)
        .where(eq(user.phone, phoneWithoutCountry))
        .limit(1);
    }

    // If still not found, try the original format
    if (!foundUser.length) {
      foundUser = await db
        .select({
          userId: user.id,
          businessId: user.businessId,
          name: user.name,
          phone: user.phone,
        })
        .from(user)
        .where(eq(user.phone, phoneNumber))
        .limit(1);
    }

    if (foundUser.length && foundUser[0]) {
      return foundUser[0];
    }

    return null;
  } catch (error) {
    logger.error("Failed to get user by phone", error);
    return null;
  }
}
