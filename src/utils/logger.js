const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

/**
 * Logger utility class using Winston for comprehensive logging
 * Supports different log levels for development and production
 * Implements log file rotation (10MB max, 5 files)
 */
class Logger {
  static instance = null;
  static logger = null;

  /**
   * Initialize the logger with appropriate configuration
   * @private
   */
  static initialize() {
    if (this.logger) {
      return;
    }

    // Determine log directory based on environment
    const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
    let logDir;

    if (isDev) {
      // Development: use ./logs/ in project directory
      logDir = path.join(process.cwd(), 'logs');
    } else {
      // Production: use app data directory
      const appDataPath = app.getPath('userData');
      logDir = path.join(appDataPath, 'logs');
    }

    // Create log directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Determine log level based on environment
    const logLevel = isDev ? 'debug' : 'info';

    // Configure Winston logger
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, component, context, stack }) => {
          const componentStr = component ? `[${component}]` : '';
          const contextStr = context ? ` ${JSON.stringify(context)}` : '';
          const stackStr = stack ? `\n${stack}` : '';
          return `[${timestamp}] [${level.toUpperCase()}] ${componentStr} ${message}${contextStr}${stackStr}`;
        })
      ),
      transports: [
        // File transport with rotation
        new winston.transports.File({
          filename: path.join(logDir, 'app.log'),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        }),
        // Error-specific log file
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        })
      ]
    });

    // Add console transport in development mode
    if (isDev) {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, component }) => {
            const componentStr = component ? `[${component}]` : '';
            return `[${timestamp}] ${level} ${componentStr} ${message}`;
          })
        )
      }));
    }

    console.log(`Logger initialized. Log directory: ${logDir}, Log level: ${logLevel}`);
  }

  /**
   * Get the logger instance
   * @private
   * @returns {winston.Logger}
   */
  static getLogger() {
    if (!this.logger) {
      this.initialize();
    }
    return this.logger;
  }

  /**
   * Log debug-level message
   * @param {string} message - The message to log
   * @param {object} context - Optional context object
   * @param {string} component - Optional component name
   */
  static debug(message, context = null, component = null) {
    const logger = this.getLogger();
    logger.debug(message, { context, component });
  }

  /**
   * Log info-level message
   * @param {string} message - The message to log
   * @param {object} context - Optional context object
   * @param {string} component - Optional component name
   */
  static info(message, context = null, component = null) {
    const logger = this.getLogger();
    logger.info(message, { context, component });
  }

  /**
   * Log warning-level message
   * @param {string} message - The message to log
   * @param {object} context - Optional context object
   * @param {string} component - Optional component name
   */
  static warn(message, context = null, component = null) {
    const logger = this.getLogger();
    logger.warn(message, { context, component });
  }

  /**
   * Log error-level message with stack trace
   * @param {string} message - The message to log
   * @param {Error|object} error - Error object or context
   * @param {string} component - Optional component name
   */
  static error(message, error = null, component = null) {
    const logger = this.getLogger();
    
    if (error instanceof Error) {
      logger.error(message, { 
        component,
        stack: error.stack,
        context: { 
          name: error.name,
          message: error.message 
        }
      });
    } else {
      logger.error(message, { context: error, component });
    }
  }

  /**
   * Log authentication attempt
   * @param {string} username - Username attempting authentication
   * @param {boolean} success - Whether authentication succeeded
   * @param {string} reason - Optional reason for failure
   */
  static logAuthAttempt(username, success, reason = null) {
    const logger = this.getLogger();
    const message = success 
      ? `Authentication successful for user: ${username}`
      : `Authentication failed for user: ${username}`;
    
    const context = { username, success };
    if (reason) {
      context.reason = reason;
    }

    if (success) {
      logger.info(message, { context, component: 'AuthManager' });
    } else {
      logger.warn(message, { context, component: 'AuthManager' });
    }
  }

  /**
   * Log policy change
   * @param {string} policyType - Type of policy (drive, browser, whitelist, domain)
   * @param {string} action - Action performed (block, allow, enable, disable, add, remove)
   * @param {boolean} success - Whether the operation succeeded
   * @param {object} details - Optional additional details
   */
  static logPolicyChange(policyType, action, success, details = null) {
    const logger = this.getLogger();
    const message = success
      ? `Policy change successful: ${policyType} - ${action}`
      : `Policy change failed: ${policyType} - ${action}`;
    
    const context = { policyType, action, success };
    if (details) {
      context.details = details;
    }

    const component = this._getPolicyComponent(policyType);

    if (success) {
      logger.info(message, { context, component });
    } else {
      logger.error(message, { context, component });
    }
  }

  /**
   * Log application event (startup, shutdown, etc.)
   * @param {string} event - Event name
   * @param {object} details - Optional event details
   */
  static logAppEvent(event, details = null) {
    const logger = this.getLogger();
    const message = `Application event: ${event}`;
    
    logger.info(message, { 
      context: details, 
      component: 'Application' 
    });
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use info() instead
   */
  static log(message, context = null, component = null) {
    this.info(message, context, component);
  }

  /**
   * Get component name based on policy type
   * @private
   * @param {string} policyType - Type of policy
   * @returns {string} Component name
   */
  static _getPolicyComponent(policyType) {
    switch (policyType) {
      case 'drive':
        return 'DrivePolicy';
      case 'browser':
      case 'whitelist':
      case 'domain':
        return 'BrowserPolicy';
      default:
        return 'PolicyManager';
    }
  }
}

module.exports = Logger;
