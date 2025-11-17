const bcrypt = require('bcrypt');
const Logger = require('../utils/logger');

class AuthManager {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.currentUser = null;
    this.authenticated = false;
  }

  /**
   * Authenticate user with username and password
   * @param {string} username - The username to authenticate
   * @param {string} password - The password to verify
   * @returns {Promise<{success: boolean, error?: object}>}
   */
  async authenticate(username, password) {
    try {
      Logger.debug(`Authentication attempt for user: ${username}`, null, 'AuthManager');
      
      const credentials = await this.dataStore.getCredentials();
      
      // Check if username matches
      if (credentials.username !== username) {
        Logger.logAuthAttempt(username, false, 'Username does not match');
        return {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password',
            details: 'Username does not match',
            recoverable: true
          }
        };
      }

      // Verify password using bcrypt
      const passwordMatch = await bcrypt.compare(password, credentials.passwordHash);
      
      if (!passwordMatch) {
        Logger.logAuthAttempt(username, false, 'Password verification failed');
        return {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password',
            details: 'Password verification failed',
            recoverable: true
          }
        };
      }

      // Authentication successful
      this.authenticated = true;
      this.currentUser = {
        username: credentials.username,
        authenticatedAt: new Date().toISOString()
      };

      Logger.logAuthAttempt(username, true);
      return {
        success: true
      };
    } catch (error) {
      Logger.error('Authentication error', error, 'AuthManager');
      Logger.logAuthAttempt(username, false, error.message);
      return {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication failed',
          details: error.message,
          recoverable: false
        }
      };
    }
  }

  /**
   * Logout the current user
   * @returns {Promise<{success: boolean}>}
   */
  async logout() {
    const username = this.currentUser ? this.currentUser.username : 'unknown';
    this.authenticated = false;
    this.currentUser = null;
    
    Logger.info(`User logged out: ${username}`, null, 'AuthManager');
    
    return {
      success: true
    };
  }

  /**
   * Check if a user is currently authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.authenticated;
  }

  /**
   * Get the current authenticated user
   * @returns {object|null}
   */
  getCurrentUser() {
    return this.currentUser;
  }
}

module.exports = AuthManager;
