/**
 * Logger utility for admin package
 * Provides unified logging interface with context support
 */

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LoggerConfig {
  level: LogLevel;
  enableTimestamp: boolean;
  enableColor: boolean;
}

class Logger {
  private context: string;
  private config: LoggerConfig;

  constructor(context: string, config?: Partial<LoggerConfig>) {
    this.context = context;
    this.config = {
      level: import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.INFO,
      enableTimestamp: import.meta.env.DEV,
      enableColor: true,
      ...config,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = this.config.enableTimestamp ? `[${new Date().toISOString()}] ` : '';
    return `${timestamp}[${this.context}] ${level}: ${message}`;
  }

  private getColorCode(level: LogLevel): string {
    if (!this.config.enableColor) return '';

    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m', // Green
      [LogLevel.WARN]: '\x1b[33m', // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
    };
    return colors[level] || '';
  }

  private resetColor(): string {
    return this.config.enableColor ? '\x1b[0m' : '';
  }

  debug(message: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const color = this.getColorCode(LogLevel.DEBUG);
    console.log(`${color}${this.formatMessage('DEBUG', message)}${this.resetColor()}`, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    const color = this.getColorCode(LogLevel.INFO);
    console.log(`${color}${this.formatMessage('INFO', message)}${this.resetColor()}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    const color = this.getColorCode(LogLevel.WARN);
    console.warn(`${color}${this.formatMessage('WARN', message)}${this.resetColor()}`, ...args);
  }

  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    const color = this.getColorCode(LogLevel.ERROR);
    console.error(
      `${color}${this.formatMessage('ERROR', message)}${this.resetColor()}`,
      error,
      ...args,
    );
  }
}

/**
 * Create a logger instance with the given context
 * @param context - Context identifier (e.g., 'AppContext', 'ImageManager')
 * @returns Logger instance
 *
 * @example
 * ```ts
 * const logger = createLogger('MyComponent');
 * logger.debug('Initializing component');
 * logger.info('Data loaded successfully');
 * logger.warn('Using fallback value');
 * logger.error('Failed to fetch data', error);
 * ```
 */
export function createLogger(context: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger(context, config);
}

/**
 * Export LogLevel for external use
 */
export { LogLevel };
