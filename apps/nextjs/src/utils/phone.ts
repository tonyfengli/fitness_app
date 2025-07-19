// Client-safe phone number normalization
// This doesn't import any server-only modules

export function normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, "");
  
  // Add country code if not present (assuming US)
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  // If already has country code
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }
  
  // Return with + if it looks like it already has country code
  if (cleaned.length > 10) {
    return `+${cleaned}`;
  }
  
  // If less than 10 digits, just return what we have with +
  return phone.startsWith("+") ? phone : `+${phone}`;
}