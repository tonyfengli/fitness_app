/**
 * Simple logger utility that can be controlled by environment variables
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel =
  LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || "error"];
const isDevelopment = process.env.NODE_ENV !== "production";

class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= currentLogLevel;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;

    switch (level) {
      case "debug":
        if (isDevelopment) {
          console.debug(prefix, message, data || "");
        }
        break;
      case "info":
        if (isDevelopment) {
          console.info(prefix, message, data || "");
        }
        break;
      case "warn":
        console.warn(prefix, message, data || "");
        break;
      case "error":
        console.error(prefix, message, data || "");
        break;
    }
  }

  debug(message: string, data?: any): void {
    this.formatMessage("debug", message, data);
  }

  info(message: string, data?: any): void {
    this.formatMessage("info", message, data);
  }

  warn(message: string, data?: any): void {
    this.formatMessage("warn", message, data);
  }

  error(message: string, data?: any): void {
    this.formatMessage("error", message, data);
  }

  /**
   * Log performance metrics (only in development)
   */
  performance(operation: string, duration: number, details?: any): void {
    if (isDevelopment && duration > 100) {
      this.warn(`Slow operation: ${operation} took ${duration}ms`, details);
    }
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}
