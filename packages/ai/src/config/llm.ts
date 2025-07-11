import { ChatOpenAI } from "@langchain/openai";

export interface LLMConfig {
  modelName: string;
  temperature: number;
  maxTokens?: number;
  timeout?: number;
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
  return new ChatOpenAI({
    modelName: config.modelName,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeout: config.timeout,
  });
}