#!/usr/bin/env tsx
import dotenv from "dotenv";
import { testOpenAIConnection } from "./utils/testLLM";

// Load environment variables
dotenv.config({ path: "../../.env" });

async function main() {
  console.log("🧪 Testing OpenAI ChatGPT-4 connection...");
  
  const success = await testOpenAIConnection();
  
  if (success) {
    console.log("✅ OpenAI integration is working perfectly!");
  } else {
    console.log("❌ OpenAI integration failed. Check your API key and connection.");
    process.exit(1);
  }
}

main().catch(console.error);