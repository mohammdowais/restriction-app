const bcrypt = require('bcrypt');
const crypto = require('crypto');

class PasswordManager {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.saltRounds = 10;
  }

  /**
   * Change password using the old password for verification
   * @param {string} oldPassword - The current password
   * @param {string} newPassword - The new password to set
   * @returns {Promise<{success: boolean, error?: object}>}
   */
  async changePasswordWithOld(oldPassword, newPassword) {
    try {
      const credentials = await this.dataStore.getCredentials();
      
      // Verify old password
      const passwordMatch = await bcrypt.compare(oldPassword, credentials.passwordHash);
      
      if (!passwordMatch) {
        return {
          success: false,
          error: {
            code: 'INVALID_OLD_PASSWORD',
            message: 'Current password is incorrect',
            details: 'Old password verification failed',
            recoverable: true
          }
        };
      }

      // Validate new password strength
      const validation = this.validatePasswordStrength(newPassword);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'New password does not meet security requirements',
            details: validation.message,
            recoverable: true
          }
        };
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);
      
      // Update credentials
      await this.dataStore.updateCredentials({
        passwordHash: newPasswordHash
      });

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PASSWORD_CHANGE_ERROR',
          message: 'Failed to change password',
          details: error.message,
          recoverable: false
        }
      };
    }
  }

  /**
   * Change password using security question answer for verification
   * @param {string} answer - The answer to the security question
   * @param {string} newPassword - The new password to set
   * @returns {Promise<{success: boolean, error?: object}>}
   */
  async changePasswordWithSecurityQuestion(answer, newPassword) {
    try {
      const credentials = await this.dataStore.getCredentials();
      
      // Check if security question is set
      if (!credentials.securityQuestion || !credentials.securityAnswerHash) {
        return {
          success: false,
          error: {
            code: 'NO_SECURITY_QUESTION',
            message: 'Security question is not set',
            details: 'No security question configured for this account',
            recoverable: false
          }
        };
      }

      // Verify security answer
      const answerMatch = await bcrypt.compare(answer, credentials.securityAnswerHash);
      
      if (!answerMatch) {
        return {
          success: false,
          error: {
            code: 'INVALID_SECURITY_ANSWER',
            message: 'Security answer is incorrect',
            details: 'Security answer verification failed',
            recoverable: true
          }
        };
      }

      // Validate new password strength
      const validation = this.validatePasswordStrength(newPassword);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'New password does not meet security requirements',
            details: validation.message,
            recoverable: true
          }
        };
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);
      
      // Update credentials
      await this.dataStore.updateCredentials({
        passwordHash: newPasswordHash
      });

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PASSWORD_CHANGE_ERROR',
          message: 'Failed to change password',
          details: error.message,
          recoverable: false
        }
      };
    }
  }

  /**
   * Change password using developer key for verification
   * @param {string} key - The developer key
   * @param {string} newPassword - The new password to set
   * @returns {Promise<{success: boolean, error?: object}>}
   */
  async changePasswordWithDeveloperKey(key, newPassword) {
    try {
      const developerKey = await this.dataStore.getDeveloperKey();
      
      // Verify developer key
      if (key !== developerKey) {
        return {
          success: false,
          error: {
            code: 'INVALID_DEVELOPER_KEY',
            message: 'Developer key is incorrect',
            details: 'Developer key verification failed',
            recoverable: true
          }
        };
      }

      // Validate new password strength
      const validation = this.validatePasswordStrength(newPassword);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'New password does not meet security requirements',
            details: validation.message,
            recoverable: true
          }
        };
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);
      
      // Update credentials
      await this.dataStore.updateCredentials({
        passwordHash: newPasswordHash
      });

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PASSWORD_CHANGE_ERROR',
          message: 'Failed to change password',
          details: error.message,
          recoverable: false
        }
      };
    }
  }

  /**
   * Set or update security question and answer
   * @param {string} question - The security question
   * @param {string} answer - The answer to the security question
   * @returns {Promise<{success: boolean, error?: object}>}
   */
  async setSecurityQuestion(question, answer) {
    try {
      // Encrypt the question
      const encryptedQuestion = this.dataStore.encryptString(question);
      
      // Hash the answer
      const answerHash = await bcrypt.hash(answer, this.saltRounds);
      
      // Update credentials
      await this.dataStore.updateCredentials({
        securityQuestion: encryptedQuestion,
        securityAnswerHash: answerHash
      });

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SECURITY_QUESTION_ERROR',
          message: 'Failed to set security question',
          details: error.message,
          recoverable: false
        }
      };
    }
  }

  /**
   * Get the security question (decrypted)
   * @returns {Promise<string|null>}
   */
  async getSecurityQuestion() {
    try {
      const credentials = await this.dataStore.getCredentials();
      
      if (!credentials.securityQuestion) {
        return null;
      }
      
      return this.dataStore.decryptString(credentials.securityQuestion);
    } catch (error) {
      throw new Error(`Failed to get security question: ${error.message}`);
    }
  }

  /**
   * Validate password strength
   * @param {string} password - The password to validate
   * @returns {{valid: boolean, message: string}}
   */
  validatePasswordStrength(password) {
    if (!password || password.length < 8) {
      return {
        valid: false,
        message: 'Password must be at least 8 characters long'
      };
    }

    if (password.length > 128) {
      return {
        valid: false,
        message: 'Password must not exceed 128 characters'
      };
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one uppercase letter'
      };
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one lowercase letter'
      };
    }

    // Check for at least one number
    if (!/[0-9]/.test(password)) {
      return {
        valid: false,
        message: 'Password must contain at least one number'
      };
    }

    return {
      valid: true,
      message: 'Password meets security requirements'
    };
  }

  /**
   * Generate a new developer key
   * @returns {Promise<{success: boolean, key?: string, error?: object}>}
   */
  async generateDeveloperKey() {
    try {
      const newKey = crypto.randomBytes(32).toString('hex');
      await this.dataStore.updateDeveloperKey(newKey);
      
      return {
        success: true,
        key: newKey
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'KEY_GENERATION_ERROR',
          message: 'Failed to generate developer key',
          details: error.message,
          recoverable: false
        }
      };
    }
  }

  /**
   * Get the current developer key
   * @returns {Promise<string>}
   */
  async getDeveloperKey() {
    return await this.dataStore.getDeveloperKey();
  }
}

module.exports = PasswordManager;
