import { promises as fs } from 'fs';
import path from 'path';
import { createLogger } from './logger';

const logger = createLogger('SessionTestDataLogger');

export interface SessionTestData {
  sessionId: string;
  timestamp: string;
  phoneNumber: string;
  messages: MessageData[];
  llmCalls: LLMCallData[];
  exerciseMatcherCalls: ExerciseMatcherCall[];
  summary: {
    totalMessages: number;
    totalLLMCalls: number;
    totalExerciseMatcherCalls: number;
    llmFallbackCount: number;
  };
}

export interface MessageData {
  timestamp?: string;
  direction: 'inbound' | 'outbound';
  content: string;
  metadata?: any;
}

export interface LLMCallData {
  timestamp: string;
  type: 'preference_parsing' | 'exercise_matching' | 'other';
  model: string;
  systemPrompt: string;
  userInput: string;
  rawResponse: any;
  parsedResponse?: any;
  parseTimeMs: number;
  error?: string;
}

export interface ExerciseMatcherCall {
  timestamp: string;
  userPhrase: string;
  intent: 'avoid' | 'include';
  matchMethod: 'exercise_type' | 'pattern' | 'llm';
  matchedExercises: string[];
  parseTimeMs: number;
  llmFallback?: {
    systemPrompt: string;
    rawResponse: any;
    reasoning: string;
  };
}

class SessionTestDataLogger {
  private sessionData: Map<string, SessionTestData> = new Map();
  private enabled: boolean = process.env.SESSION_TEST_DATA_ENABLED === 'true' || true; // Temporarily always enabled

  enable() {
    this.enabled = true;
    logger.info('Session test data logging enabled');
  }

  disable() {
    this.enabled = false;
    logger.info('Session test data logging disabled');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Initialize a new session
  initSession(sessionId: string, phoneNumber: string) {
    if (!this.enabled) return;
    
    this.sessionData.set(sessionId, {
      sessionId,
      timestamp: new Date().toISOString(),
      phoneNumber,
      messages: [],
      llmCalls: [],
      exerciseMatcherCalls: [],
      summary: {
        totalMessages: 0,
        totalLLMCalls: 0,
        totalExerciseMatcherCalls: 0,
        llmFallbackCount: 0
      }
    });
    
    logger.info('Initialized session test data', { sessionId, phoneNumber });
  }

  // Log a message
  logMessage(sessionId: string, message: MessageData) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) {
      logger.warn('Session not found for message logging', { sessionId });
      return;
    }
    
    session.messages.push({
      ...message,
      timestamp: new Date().toISOString()
    });
    session.summary.totalMessages++;
  }

  // Log an LLM call
  logLLMCall(sessionId: string, llmCall: Omit<LLMCallData, 'timestamp'>) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) {
      logger.warn('Session not found for LLM call logging', { sessionId });
      return;
    }
    
    session.llmCalls.push({
      ...llmCall,
      timestamp: new Date().toISOString()
    });
    session.summary.totalLLMCalls++;
  }

  // Log an exercise matcher call
  logExerciseMatcherCall(sessionId: string, matcherCall: Omit<ExerciseMatcherCall, 'timestamp'>) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) {
      logger.warn('Session not found for exercise matcher logging', { sessionId });
      return;
    }
    
    session.exerciseMatcherCalls.push({
      ...matcherCall,
      timestamp: new Date().toISOString()
    });
    session.summary.totalExerciseMatcherCalls++;
    
    if (matcherCall.matchMethod === 'llm') {
      session.summary.llmFallbackCount++;
    }
  }

  // Save session data to file
  async saveSessionData(sessionId: string) {
    if (!this.enabled) return;
    
    const session = this.sessionData.get(sessionId);
    if (!session) {
      logger.warn('Session not found for saving', { sessionId });
      return;
    }
    
    try {
      // Create directory if it doesn't exist
      const dirPath = path.join(process.cwd(), 'session-test-data');
      await fs.mkdir(dirPath, { recursive: true });
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `session_${sessionId}_${timestamp}.json`;
      const filepath = path.join(dirPath, filename);
      
      // Write the file
      await fs.writeFile(
        filepath,
        JSON.stringify(session, null, 2),
        'utf-8'
      );
      
      logger.info('Session test data saved', { 
        sessionId, 
        filepath,
        summary: session.summary 
      });
      
      // Also save a "latest" file for easy access
      const latestPath = path.join(dirPath, 'latest-session.json');
      await fs.writeFile(
        latestPath,
        JSON.stringify(session, null, 2),
        'utf-8'
      );
      
      // Clear session data from memory
      this.sessionData.delete(sessionId);
      
    } catch (error) {
      logger.error('Failed to save session test data', { sessionId, error });
    }
  }

  // Get current session data (for debugging)
  getSessionData(sessionId: string): SessionTestData | undefined {
    return this.sessionData.get(sessionId);
  }

  // Clear session data
  clearSession(sessionId: string) {
    this.sessionData.delete(sessionId);
  }
}

export const sessionTestDataLogger = new SessionTestDataLogger();