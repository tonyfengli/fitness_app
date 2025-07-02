import { ChatOpenAI } from "@langchain/openai";
import { validateOpenAIConfig } from "./llm";

/**
 * Test function to verify OpenAI integration is working
 * Uses a cheaper model for testing to avoid quota issues
 */
export async function testOpenAIConnection() {
  try {
    validateOpenAIConfig();
    
    // Use latest and greatest GPT-4o for testing
    const testLLM = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.1,
      maxTokens: 100,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
    
    const response = await testLLM.invoke([
      {
        role: "user",
        content: "You are testing the latest GPT-4o model. Please respond with 'GPT-4o integration successful!' and tell me one interesting fact about exercise science."
      }
    ]);
    
    console.log("✅ OpenAI Test Response:", response.content);
    return true;
  } catch (error) {
    console.error("❌ OpenAI Test Failed:", error);
    return false;
  }
}