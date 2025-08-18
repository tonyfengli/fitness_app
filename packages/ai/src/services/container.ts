import type { LLMProvider } from "../config/llm";
import type { ExerciseRepository } from "../repositories/exerciseRepository";
import type { Logger } from "../utils/logger";
import { createLLM } from "../config/llm";
import { ConsoleLogger } from "../utils/logger";

export interface ServiceContainer {
  logger: Logger;
  llm?: LLMProvider;
  exerciseRepository?: ExerciseRepository;
}

export interface ServiceOptions {
  logger?: Logger;
  llm?: LLMProvider;
  exerciseRepository?: ExerciseRepository;
}

/**
 * Creates a service container with optional overrides
 * This allows us to inject mocks during testing
 */
export function createServices(options?: ServiceOptions): ServiceContainer {
  return {
    logger: options?.logger ?? new ConsoleLogger(),
    llm: options?.llm,
    exerciseRepository: options?.exerciseRepository,
  };
}

// Global service container (can be overridden in tests)
let globalServices: ServiceContainer | undefined;

export function getServices(): ServiceContainer {
  if (!globalServices) {
    globalServices = createServices();
  }
  return globalServices;
}

export function setServices(services: ServiceContainer): void {
  globalServices = services;
}

export function resetServices(): void {
  globalServices = undefined;
}
