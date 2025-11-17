const { exec } = require('child_process');
const { promisify } = require('util');
const Logger = require('../utils/logger');
const PrivilegeChecker = require('../utils/privilegeChecker');

const execAsync = promisify(exec);

/**
 * DrivePolicy - Manages external drive write access policies via Windows Registry
 */
class DrivePolicy {
  constructor() {
    this.registryPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\StorageDevicePolicies';
    this.registryValueName = 'WriteProtect';
  }

  /**
   * Block write access to external removable drives
   * @returns {Promise<Object>} Result object with success status and message
   */
  // async blockWriteAccess() {
  //   try {
  //     Logger.info('Attempting to block external drive write access', null, 'DrivePolicy');

  //     // Verify administrator privileges
  //     const privilegeCheck = await PrivilegeChecker.verifyPrivilegesForOperation('Block External Drive Write Access');
  //     if (!privilegeCheck.success) {
  //       Logger.warn('Privilege check failed for blocking drive write access', privilegeCheck.error, 'DrivePolicy');
  //       return privilegeCheck;
  //     }

  //     // Create the registry key if it doesn't exist, then set WriteProtect to 1
  //     const command = `powershell -Command "` +
  //       `if (-not (Test-Path '${this.registryPath}')) { ` +
  //       `New-Item -Path '${this.registryPath}' -Force | Out-Null; ` +
  //       `}; ` +
  //       `Set-ItemProperty -Path '${this.registryPath}' -Name '${this.registryValueName}' -Value 1 -Type DWord -Force"`;

  //     await execAsync(command, { shell: 'powershell.exe' });

  //     Logger.info('External drive write access blocked successfully', null, 'DrivePolicy');
      
  //     return {
  //       success: true,
  //       message: 'External drive write access has been blocked',
  //       status: 'blocked'
  //     };
  //   } catch (error) {
  //     return this._handleRegistryError(error, 'block write access');
  //   }
  // }
  async blockWriteAccess() {
  try {
    Logger.info('Attempting to block external drive write access', null, 'DrivePolicy');

    // Verify administrator privileges
    const privilegeCheck = await PrivilegeChecker.verifyPrivilegesForOperation('Block External Drive Write Access');
    if (!privilegeCheck.success) {
      Logger.warn('Privilege check failed for blocking drive write access', privilegeCheck.error, 'DrivePolicy');
      return privilegeCheck;
    }

    const command = `
      if (-not (Test-Path '${this.registryPath}')) {
        New-Item -Path '${this.registryPath}' -Force | Out-Null;
      };
      Set-ItemProperty -Path '${this.registryPath}' -Name '${this.registryValueName}' -Value 1 -Type DWord -Force
    `;

    const { stdout, stderr } = await execAsync(`powershell -Command "${command}"`, {
      shell: 'powershell.exe'
    });

    Logger.info(`PowerShell stdout: ${stdout}`, null, 'DrivePolicy');
    if (stderr) {
      Logger.warn(`PowerShell stderr: ${stderr}`, null, 'DrivePolicy');
    }

    Logger.info('External drive write access blocked successfully', null, 'DrivePolicy');

    return {
      success: true,
      message: 'External drive write access has been blocked',
      status: 'blocked'
    };

  } catch (error) {
    return this._handleRegistryError(error, 'block write access');
  }
}

  /**
   * Allow write access to external removable drives
   * @returns {Promise<Object>} Result object with success status and message
   */
  async allowWriteAccess() {
    try {
      Logger.info('Attempting to allow external drive write access', null, 'DrivePolicy');

      // Verify administrator privileges
      const privilegeCheck = await PrivilegeChecker.verifyPrivilegesForOperation('Allow External Drive Write Access');
      if (!privilegeCheck.success) {
        Logger.warn('Privilege check failed for allowing drive write access', privilegeCheck.error, 'DrivePolicy');
        return privilegeCheck;
      }

      // Set WriteProtect to 0 to allow write access
      const command = `powershell -Command "` +
        `if (-not (Test-Path '${this.registryPath}')) { ` +
        `New-Item -Path '${this.registryPath}' -Force | Out-Null; ` +
        `}; ` +
        `Set-ItemProperty -Path '${this.registryPath}' -Name '${this.registryValueName}' -Value 0 -Type DWord -Force"`;

      await execAsync(command, { shell: 'powershell.exe' });

      Logger.info('External drive write access allowed successfully', null, 'DrivePolicy');
      
      return {
        success: true,
        message: 'External drive write access has been allowed',
        status: 'allowed'
      };
    } catch (error) {
      return this._handleRegistryError(error, 'allow write access');
    }
  }

  /**
   * Get current write access status for external drives
   * @returns {Promise<Object>} Result object with current status
   */
  async getWriteAccessStatus() {
    try {
      Logger.debug('Checking external drive write access status', null, 'DrivePolicy');

      // Read the WriteProtect value from registry
      const command = `powershell -Command "` +
        `try { ` +
        `$value = Get-ItemProperty -Path '${this.registryPath}' -Name '${this.registryValueName}' -ErrorAction Stop; ` +
        `$value.${this.registryValueName}; ` +
        `} catch { ` +
        `Write-Output '-1'; ` +
        `}"`;

      const { stdout } = await execAsync(command, { shell: 'powershell.exe' });
      const value = parseInt(stdout.trim(), 10);

      let status;
      let isBlocked;
      
      if (value === 1) {
        status = 'blocked';
        isBlocked = true;
      } else if (value === 0) {
        status = 'allowed';
        isBlocked = false;
      } else {
        // Registry key doesn't exist or error reading it
        status = 'allowed'; // Default Windows behavior
        isBlocked = false;
      }

      Logger.debug(`External drive write access status: ${status}`, { value, isBlocked }, 'DrivePolicy');

      return {
        success: true,
        status: status,
        isBlocked: isBlocked,
        message: `External drive write access is currently ${status}`
      };
    } catch (error) {
      return this._handleRegistryError(error, 'read write access status');
    }
  }

  /**
   * Handle registry operation errors with structured error responses
   * @private
   * @param {Error} error - The error object
   * @param {string} operation - Description of the operation that failed
   * @returns {Object} Structured error response
   */
  _handleRegistryError(error, operation) {
    Logger.error(`Failed to ${operation}`, error, 'DrivePolicy');

    const errorMessage = error.message || error.toString();
    const errorLower = errorMessage.toLowerCase();

    // Check for specific error types
    if (errorLower.includes('access is denied') || errorLower.includes('access denied')) {
      return {
        success: false,
        error: {
          code: 'REGISTRY_ACCESS_DENIED',
          message: 'Registry access denied',
          details: `Cannot ${operation}: Registry access was denied. Administrator privileges may be insufficient or registry key is protected.`,
          recoverable: true,
          originalError: errorMessage
        }
      };
    }

    if (errorLower.includes('privilege') || errorLower.includes('administrator')) {
      return {
        success: false,
        error: {
          code: 'INSUFFICIENT_PRIVILEGES',
          message: 'Insufficient privileges',
          details: `Cannot ${operation}: Administrator privileges are required to modify registry settings.`,
          recoverable: true,
          originalError: errorMessage
        }
      };
    }

    if (errorLower.includes('registry') || errorLower.includes('itemnotfound')) {
      return {
        success: false,
        error: {
          code: 'REGISTRY_ERROR',
          message: 'Registry operation failed',
          details: `Cannot ${operation}: Registry operation encountered an error.`,
          recoverable: true,
          originalError: errorMessage
        }
      };
    }

    // Generic error
    return {
      success: false,
      error: {
        code: 'OPERATION_FAILED',
        message: 'Operation failed',
        details: `Cannot ${operation}: An unexpected error occurred.`,
        recoverable: false,
        originalError: errorMessage
      }
    };
  }
}

module.exports = DrivePolicy;
