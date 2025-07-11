import type { LLMProvider } from '../../src/config/llm';

export interface MockLLMOptions {
  defaultResponse?: string;
  responses?: Record<string, string>;
  shouldThrow?: boolean;
  errorMessage?: string;
}

/**
 * Mock LLM provider for testing
 */
export class MockLLM implements LLMProvider {
  private options: MockLLMOptions;
  public calls: { messages: any[]; response: any }[] = [];
  
  constructor(options: MockLLMOptions = {}) {
    this.options = options;
  }
  
  async invoke(messages: any[]): Promise<any> {
    if (this.options.shouldThrow) {
      throw new Error(this.options.errorMessage || 'Mock LLM error');
    }
    
    // Extract the user message to determine response
    const userMessage = messages.find(m => m.constructor.name === 'HumanMessage');
    const content = userMessage?.content || '';
    
    // Check for specific responses
    let responseContent = this.options.defaultResponse || '{"error": "No mock response configured"}';
    
    if (this.options.responses) {
      // Find matching response based on content
      for (const [key, value] of Object.entries(this.options.responses)) {
        if (content.includes(key)) {
          responseContent = value;
          break;
        }
      }
    }
    
    const response = {
      content: {
        toString: () => responseContent
      }
    };
    
    this.calls.push({ messages, response });
    
    return response;
  }
  
  clear(): void {
    this.calls = [];
  }
  
  getLastCall(): { messages: any[]; response: any } | undefined {
    return this.calls[this.calls.length - 1];
  }
}