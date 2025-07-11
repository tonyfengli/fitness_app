import type { Logger } from '../../src/utils/logger';

/**
 * Silent logger for tests - captures logs without outputting
 */
export class TestLogger implements Logger {
  public logs: Array<{ level: string; message: string; data?: any }> = [];
  
  log(message: string, data?: any): void {
    this.logs.push({ level: 'log', message, data });
  }
  
  error(message: string, error?: any): void {
    this.logs.push({ level: 'error', message, data: error });
  }
  
  warn(message: string, data?: any): void {
    this.logs.push({ level: 'warn', message, data });
  }
  
  debug(message: string, data?: any): void {
    this.logs.push({ level: 'debug', message, data });
  }
  
  clear(): void {
    this.logs = [];
  }
  
  hasLog(message: string): boolean {
    return this.logs.some(log => log.message.includes(message));
  }
  
  getLogsOfLevel(level: string): Array<{ message: string; data?: any }> {
    return this.logs
      .filter(log => log.level === level)
      .map(({ message, data }) => ({ message, data }));
  }
}