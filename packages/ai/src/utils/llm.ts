import { ChatOpenAI } from "@langchain/openai";

/**
 * OpenAI ChatGPT LLM instance for exercise preference scoring
 * Configured for fitness and exercise recommendation tasks
 */
export const openAILLM = new ChatOpenAI({
  modelName: "gpt-4o", // Latest and greatest GPT-4 model
  temperature: 0.1, // Low temperature for consistent scoring
  maxTokens: 2000, // Sufficient for exercise analysis
  openAIApiKey: process.env.OPENAI_API_KEY,
  timeout: 60000, // 60 second timeout
});

/**
 * Validate that OpenAI API key is configured
 * @throws Error if API key is missing
 */
export function validateOpenAIConfig() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
    throw new Error('Invalid OpenAI API key format');
  }
}