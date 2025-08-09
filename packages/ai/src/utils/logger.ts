export interface Logger {
  log(message: string, data?: any): void;
  error(message: string, error?: any): void;
  warn(message: string, data?: any): void;
  debug(message: string, data?: any): void;
}

export class ConsoleLogger implements Logger {
  private enabled: boolean;
  
  constructor(enabled: boolean = process.env.NODE_ENV !== 'test' && process.env.DEBUG === 'true') {
    this.enabled = enabled;
  }
  
  log(message: string, data?: any): void {
    if (this.enabled) {
      if (data !== undefined) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  }
  
  error(message: string, error?: any): void {
    if (this.enabled) {
      if (error !== undefined) {
        console.error(message, error);
      } else {
        console.error(message);
      }
    }
  }
  
  warn(message: string, data?: any): void {
    if (this.enabled) {
      if (data !== undefined) {
        console.warn(message, data);
      } else {
        console.warn(message);
      }
    }
  }
  
  debug(message: string, data?: any): void {
    if (this.enabled && process.env.DEBUG) {
      if (data !== undefined) {
        console.debug(message, data);
      } else {
        console.debug(message);
      }
    }
  }
}

// Singleton instance
let defaultLogger: Logger | undefined;

export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new ConsoleLogger();
  }
  return defaultLogger;
}

export function setLogger(logger: Logger): void {
  defaultLogger = logger;
}