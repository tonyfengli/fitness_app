import { ChatOpenAI } from "@langchain/openai";

export interface LLMConfig {
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  // GPT-5 specific parameters
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
  verbosity?: "low" | "normal" | "verbose";
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
    timeout: config.timeout,
    maxRetries: 0, // Disable retries to see raw behavior
  };

  // For GPT-5, parameters might need to be passed via modelKwargs
  const modelKwargs: any = {};

  // GPT-5 and GPT-5-mini only support default temperature of 1
  if (config.modelName === "gpt-5" || config.modelName === "gpt-5-mini") {
    // Don't set temperature for GPT-5 models - they will use the default of 1
    if (config.maxTokens) {
      options.max_completion_tokens = config.maxTokens;
    }
  } else {
    // For other models, use the configured temperature
    options.temperature = config.temperature;
    if (config.maxTokens) {
      options.maxTokens = config.maxTokens;
    }
  }

  // Add GPT-5 specific parameters
  // Try both approaches - direct options AND modelKwargs
  if (config.modelName === "gpt-5" || config.modelName === "gpt-5-mini") {
    // Approach 1: Direct options (what we had before)
    if (config.reasoning_effort) {
      options.reasoning_effort = config.reasoning_effort;
      modelKwargs.reasoning_effort = config.reasoning_effort;
    }
    if (config.verbosity) {
      options.verbosity = config.verbosity;
      modelKwargs.verbosity = config.verbosity;
    }

    // Approach 2: modelKwargs (LangChain might need this)
    if (Object.keys(modelKwargs).length > 0) {
      options.modelKwargs = modelKwargs;
    }

    // Approach 3: Try configuration object
    options.configuration = {
      reasoning_effort: config.reasoning_effort,
      verbosity: config.verbosity,
    };
  }

  const llm = new ChatOpenAI(options);

  // Add debugging for GPT-5 responses in development
  if (
    process.env.NODE_ENV === "development" &&
    (config.modelName === "gpt-5" || config.modelName === "gpt-5-mini")
  ) {
    console.log(`[createLLM] ${config.modelName} configuration:`, options);
  }

  return llm;
}
