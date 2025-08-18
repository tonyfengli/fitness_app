/**
 * Business validation utilities for LangGraph workflows
 * Helps ensure business context is valid before processing
 */

/**
 * Validates business ID format
 */
export function isValidBusinessId(
  businessId: string | undefined | null,
): businessId is string {
  if (!businessId) return false;

  // Basic UUID format validation
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(businessId);
}

/**
 * Sanitizes business ID - returns valid business ID or null
 * Useful for LangGraph nodes to handle invalid business context gracefully
 */
export function sanitizeBusinessId(
  businessId: string | undefined | null,
): string | null {
  if (!businessId) return null;

  // Trim whitespace and validate
  const trimmed = businessId.trim();
  return isValidBusinessId(trimmed) ? trimmed : null;
}

/**
 * Default business ID for fallback scenarios
 * Centralized so it can be easily changed if needed
 */
export const DEFAULT_BUSINESS_ID = "d33b41e2-f700-4a08-9489-cb6e3daa7f20";

/**
 * Get business ID with fallback logic
 * Returns valid business ID or null (triggering fallback to all exercises)
 */
export function getBusinessIdWithFallback(
  businessId: string | undefined | null,
  allowFallback = true,
): string | null {
  const sanitized = sanitizeBusinessId(businessId);

  if (sanitized) {
    return sanitized;
  }

  if (allowFallback) {
    console.warn(
      "Invalid or missing business ID, falling back to all exercises",
    );
    return null; // This triggers the fetchAllExercises() path
  }

  return DEFAULT_BUSINESS_ID;
}
