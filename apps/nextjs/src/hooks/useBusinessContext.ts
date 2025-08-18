/**
 * Business Context Hook
 *
 * Provides business context for the current user.
 * Currently defaults to Tony Gym, but designed to integrate with authentication later.
 *
 * TODO: Integrate with authentication system when available
 */

export interface BusinessContext {
  businessId: string;
  businessName: string;
  isAuthenticated?: boolean; // Future: indicates if context comes from auth
  permissions?: string[]; // Future: user permissions for this business
}

/**
 * Hook to get the current business context
 *
 * @returns BusinessContext object with businessId and businessName
 */
export function useBusinessContext(): BusinessContext {
  // TODO: Replace with actual authentication when ready
  // const { user } = useAuth();
  // return {
  //   businessId: user?.businessId || getDefaultBusinessId(),
  //   businessName: user?.businessName || getDefaultBusinessName()
  // };

  // For now, use default business (configurable via environment)
  return {
    businessId: getDefaultBusinessId(),
    businessName: getDefaultBusinessName(),
    isAuthenticated: false, // Will be true when auth is integrated
    permissions: ["read", "write"], // Default permissions - will be dynamic with auth
  };
}

/**
 * Get default business ID (configurable via environment)
 */
function getDefaultBusinessId(): string {
  // Allow environment override for different deployments
  const envBusinessId = process.env.NEXT_PUBLIC_DEFAULT_BUSINESS_ID;
  const defaultBusinessId = "d33b41e2-f700-4a08-9489-cb6e3daa7f20";

  const businessId = envBusinessId ?? defaultBusinessId;

  // Basic UUID validation to catch configuration errors early
  if (!isValidUUID(businessId)) {
    console.warn(`Invalid business ID format: ${businessId}. Using default.`);
    return defaultBusinessId;
  }

  return businessId;
}

/**
 * Get default business name (configurable via environment)
 */
function getDefaultBusinessName(): string {
  return process.env.NEXT_PUBLIC_DEFAULT_BUSINESS_NAME ?? "Tony Gym";
}

/**
 * Simple UUID validation (basic format check)
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Hook to get just the business ID (convenience function)
 *
 * @returns string - Current business ID
 */
export function useBusinessId(): string {
  const { businessId } = useBusinessContext();
  return businessId;
}

/**
 * Hook to check if user has specific permission
 * Future-proofing for when permissions are implemented
 *
 * @param permission - Permission to check
 * @returns boolean - Whether user has the permission
 */
export function useHasPermission(permission: string): boolean {
  const { permissions } = useBusinessContext();
  return permissions?.includes(permission) ?? false;
}
