/**
 * Logger utilities for the version management system
 */

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

/**
 * Log an info message
 * @param {string} message - Message to log
 */
export function info(message) {
  console.log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
}

/**
 * Log a success message
 * @param {string} message - Message to log
 */
export function success(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

/**
 * Log a warning message
 * @param {string} message - Message to log
 */
export function warn(message) {
  console.warn(`${colors.yellow}⚠️  Warning: ${message}${colors.reset}`);
}

/**
 * Log an error message
 * @param {string} message - Message to log
 */
export function error(message) {
  console.error(`${colors.red}❌ Error: ${message}${colors.reset}`);
}

/**
 * Log a step message (for beginning an operation)
 * @param {string} message - Message to log
 */
export function step(message) {
  console.log(`\n${colors.magenta}⏳ ${message}${colors.reset}`);
}

/**
 * Log a debug message (only shown in verbose mode)
 * @param {string} message - Message to log
 */
export function debug(message) {
  if (process.env.DEBUG) {
    console.log(`${colors.dim}🔍 ${message}${colors.reset}`);
  }
}

/**
 * Log a header message
 * @param {string} message - Message to log
 */
export function header(message) {
  console.log(
    `\n${colors.bright}${colors.cyan}${message}${colors.reset}\n${'-'.repeat(message.length)}`,
  );
}

export const logger = {
  info,
  success,
  warn,
  error,
  step,
  debug,
  header,
};
