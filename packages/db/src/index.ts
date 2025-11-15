export * from "drizzle-orm/sql";
export { alias } from "drizzle-orm/pg-core";
export { eq, and, or, desc, asc, sql } from "drizzle-orm";

// Export database client
export { db } from "./client";
export type { Database } from "./client";

// Export all schema tables
export * from "./schema";

// Export types
export type { CircuitConfig, LegacyCircuitConfig } from "./types/circuit-config";
export { DEFAULT_CIRCUIT_CONFIG, EMPTY_CIRCUIT_CONFIG, createDefaultRoundTemplates, migrateToRoundTemplates } from "./types/circuit-config";
export type { RoundTemplate, CircuitRoundTemplate, StationsRoundTemplate, RoundConfig } from "./types/round-templates";
