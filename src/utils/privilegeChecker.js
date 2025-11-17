const { exec } = require('child_process');
const { promisify } = require('util');
const Logger = require('./logger');

const execAsync = promisify(exec);

/**
 * PrivilegeChecker - Utility for checking and managing administrator privileges
 */
class PrivilegeChecker {
  /**
   * Check if the application is running with administrator privileges
   * @returns {Promise<boolean>} True if running as administrator, false otherwise
   */
  static async checkAdminPrivileges() {
    try {
      // Use 'net session' command which requires admin privileges
      // If it succeeds, we have admin rights; if it fails, we don't
      await execAsync('net session', { shell: 'cmd.exe' });
      Logger.log('Administrator privileges confirmed');
      return true;
    } catch (error) {
      Logger.warn('Application is not running with administrator privileges');
      return false;
    }
  }

  /**
   * Request UAC elevation by restarting the application with admin privileges
   * Note: This method provides instructions since Electron handles elevation via app manifest
   * @returns {Object} Information about elevation request
   */
  static requestElevation() {
    const elevationInfo = {
      success: false,
      message: 'Administrator privileges required',
      instructions: [
        'Please close this application',
        'Right-click on the application icon',
        'Select "Run as administrator"',
        'Restart the application with elevated privileges'
      ],
      canAutoElevate: false
    };

    Logger.warn('UAC elevation requested - manual restart required');
    
    return elevationInfo;
  }

  /**
   * Get detailed privilege status information
   * @returns {Promise<Object>} Detailed privilege status
   */
  static async getPrivilegeStatus() {
    const isAdmin = await this.checkAdminPrivileges();
    
    return {
      hasAdminPrivileges: isAdmin,
      canModifyPolicies: isAdmin,
      requiresElevation: !isAdmin,
      platform: process.platform,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Verify privileges before executing a privileged operation
   * @param {string} operationName - Name of the operation requiring privileges
   * @returns {Promise<Object>} Result object with success status and message
   */
  static async verifyPrivilegesForOperation(operationName) {
    const isAdmin = await this.checkAdminPrivileges();
    
    if (!isAdmin) {
      const error = {
        success: false,
        error: {
          code: 'INSUFFICIENT_PRIVILEGES',
          message: 'Administrator privileges required',
          details: `Cannot execute ${operationName} without administrator privileges`,
          recoverable: true,
          recovery: this.requestElevation()
        }
      };
      
      Logger.error(`Privilege check failed for operation: ${operationName}`);
      return error;
    }

    Logger.log(`Privilege check passed for operation: ${operationName}`);
    return {
      success: true,
      message: 'Administrator privileges verified'
    };
  }
}

module.exports = PrivilegeChecker;
