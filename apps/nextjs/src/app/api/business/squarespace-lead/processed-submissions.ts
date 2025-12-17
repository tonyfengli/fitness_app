// Simple in-memory store for processed submission IDs
// In production, you'd want to use a database or Redis
// This resets when the server restarts, which is fine - we'll just reprocess recent submissions

const processedSubmissions = new Set<string>();
const MAX_STORED_IDS = 1000; // Prevent memory issues

export function markAsProcessed(submissionId: string) {
  processedSubmissions.add(submissionId);
  
  // Cleanup old entries if we exceed the limit
  if (processedSubmissions.size > MAX_STORED_IDS) {
    const idsArray = Array.from(processedSubmissions);
    const idsToKeep = idsArray.slice(-800); // Keep most recent 800
    processedSubmissions.clear();
    idsToKeep.forEach(id => processedSubmissions.add(id));
  }
}

export function isAlreadyProcessed(submissionId: string): boolean {
  return processedSubmissions.has(submissionId);
}

export function getProcessedCount(): number {
  return processedSubmissions.size;
}