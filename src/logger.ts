import { LogLevel } from './types';

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.WARNING;
  private tag = 'AudioStream';

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  setTag(tag: string): void {
    this.tag = tag;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + JSON.stringify(args) : '';
    return `[${timestamp}] [${this.tag}] [${level}] ${message}${formattedArgs}`;
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARNING)) {
      console.warn(this.formatMessage('WARN', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message, ...args));
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('DEBUG', message, ...args));
    }
  }

  verbose(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.VERBOSE)) {
      console.log(this.formatMessage('VERBOSE', message, ...args));
    }
  }

  // Performance logging
  time(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.time(`[${this.tag}] ${label}`);
    }
  }

  timeEnd(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.timeEnd(`[${this.tag}] ${label}`);
    }
  }

  // Network logging
  logNetworkRequest(url: string, headers?: Record<string, string>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.debug('Network Request', { url, headers });
    }
  }

  logNetworkResponse(url: string, status: number, duration: number): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.debug('Network Response', { url, status, duration: `${duration}ms` });
    }
  }

  // Buffer logging
  logBufferStatus(bufferedPercentage: number, bufferHealth: number): void {
    if (this.shouldLog(LogLevel.VERBOSE)) {
      this.verbose('Buffer Status', {
        bufferedPercentage: `${bufferedPercentage}%`,
        bufferHealth: `${bufferHealth}%`,
      });
    }
  }

  // Playback logging
  logPlaybackEvent(event: string, details?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.info(`Playback Event: ${event}`, details);
    }
  }

  // Error logging with stack trace
  logError(error: Error | string, context?: string): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorMessage = error instanceof Error ? error.message : error;
      const stack = error instanceof Error ? error.stack : undefined;
      this.error(`${context ? `[${context}] ` : ''}${errorMessage}`, { stack });
    }
  }
}

export const logger = Logger.getInstance(); 