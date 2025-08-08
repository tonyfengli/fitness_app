import { ChatOpenAI } from "@langchain/openai";

export interface LLMConfig {
  modelName: string;
  temperature: number;
  maxTokens?: number;
  timeout?: number;
  // GPT-5 specific parameters
  reasoning_effort?: "low" | "medium" | "high";
  verbosity?: "concise" | "normal" | "verbose";
}

export interface LLMProvider {
  invoke(messages: any[]): Promise<any>;
}

export const defaultLLMConfig: LLMConfig = {
  modelName: process.env.LLM_MODEL_NAME || "gpt-4o",
  temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.3"),
  maxTokens: parseInt(process.env.LLM_MAX_TOKENS || "2000"),
  timeout: parseInt(process.env.LLM_TIMEOUT || "60000"),
};

export function createLLM(config: LLMConfig = defaultLLMConfig): LLMProvider {
  const options: any = {
    modelName: config.modelName,
    temperature: config.temperature,
    timeout: config.timeout,
  };

  // GPT-5 uses max_completion_tokens instead of maxTokens
  if (config.modelName === "gpt-5" && config.maxTokens) {
    options.max_completion_tokens = config.maxTokens;
  } else if (config.maxTokens) {
    options.maxTokens = config.maxTokens;
  }

  // Add GPT-5 specific parameters if provided
  if (config.reasoning_effort) {
    options.reasoning_effort = config.reasoning_effort;
  }
  if (config.verbosity) {
    options.verbosity = config.verbosity;
  }

  return new ChatOpenAI(options);
}