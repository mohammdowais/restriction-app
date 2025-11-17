const bcrypt = require('bcrypt');

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
      const credentials = await this.dataStore.getCredentials();
      
      // Check if username matches
      if (credentials.username !== username) {
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

      return {
        success: true
      };
    } catch (error) {
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
    this.authenticated = false;
    this.currentUser = null;
    
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
