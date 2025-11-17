const DrivePolicy = require('./drivePolicy');
const BrowserPolicy = require('./browserPolicy');
const PrivilegeChecker = require('../utils/privilegeChecker');
const Logger = require('../utils/logger');

/**
 * PolicyManager - Orchestrates policy operations across DrivePolicy and BrowserPolicy
 * Coordinates privilege checking and policy application
 */
class PolicyManager {
  constructor() {
    this.drivePolicy = new DrivePolicy();
    this.browserPolicy = new BrowserPolicy();
  }

  /**
   * Apply a policy based on policy type and settings
   * @param {string} policyType - Type of policy ('drive', 'browser', 'whitelist')
   * @param {Object} settings - Policy-specific settings
   * @returns {Promise<Object>} Result object with success status and message
   */
  async applyPolicy(policyType, settings) {
    try {
      Logger.log(`Applying policy: ${policyType}`, settings);

      // Verify administrator privileges before any policy modification
      const privilegeCheck = await PrivilegeChecker.verifyPrivilegesForOperation(`Apply ${policyType} policy`);
      if (!privilegeCheck.success) {
        return privilegeCheck;
      }

      let result;

      switch (policyType) {
        case 'drive':
          result = await this._applyDrivePolicy(settings);
          break;

        case 'browser':
          result = await this._applyBrowserPolicy(settings);
          break;

        case 'whitelist':
          result = await this._applyWhitelistPolicy(settings);
          break;

        case 'domain':
          result = await this._applyDomainPolicy(settings);
          break;

        default:
          result = {
            success: false,
            error: {
              code: 'INVALID_POLICY_TYPE',
              message: 'Invalid policy type',
              details: `Unknown policy type: ${policyType}. Valid types are: drive, browser, whitelist, domain`,
              recoverable: false
            }
          };
      }

      if (result.success) {
        Logger.log(`Policy applied successfully: ${policyType}`);
      } else {
        Logger.error(`Failed to apply policy: ${policyType}`, result.error);
      }

      return result;
    } catch (error) {
      Logger.error(`Error applying policy: ${policyType}`, error);
      return {
        success: false,
        error: {
          code: 'POLICY_APPLICATION_ERROR',
          message: 'Failed to apply policy',
          details: error.message || 'An unexpected error occurred while applying the policy',
          recoverable: false,
          originalError: error.toString()
        }
      };
    }
  }

  /**
   * Get current status of all policies
   * @returns {Promise<Object>} Current policy status across all policy types
   */
  async getCurrentPolicyStatus() {
    try {
      Logger.log('Retrieving current policy status');

      // Get drive policy status
      const driveStatus = await this.drivePolicy.getWriteAccessStatus();
      
      // Get domain list (indicates if whitelist is active)
      const domainList = await this.browserPolicy.getDomainList();
      
      // Determine browser policy status based on domain list
      const whitelistActive = domainList.success && domainList.count > 0;

      const status = {
        success: true,
        timestamp: new Date().toISOString(),
        policies: {
          drive: {
            writeBlocked: driveStatus.success ? driveStatus.isBlocked : false,
            status: driveStatus.success ? driveStatus.status : 'unknown',
            error: driveStatus.success ? null : driveStatus.error
          },
          browser: {
            whitelistActive: whitelistActive,
            whitelistedDomains: domainList.success ? domainList.domains : [],
            domainCount: domainList.success ? domainList.count : 0
          }
        }
      };

      Logger.log('Policy status retrieved successfully', status);
      return status;
    } catch (error) {
      Logger.error('Error retrieving policy status', error);
      return {
        success: false,
        error: {
          code: 'STATUS_RETRIEVAL_ERROR',
          message: 'Failed to retrieve policy status',
          details: error.message || 'An unexpected error occurred while retrieving policy status',
          recoverable: true,
          originalError: error.toString()
        }
      };
    }
  }

  /**
   * Apply drive policy settings
   * @private
   * @param {Object} settings - Drive policy settings
   * @param {boolean} settings.blockWriteAccess - Whether to block write access
   * @returns {Promise<Object>} Result object
   */
  async _applyDrivePolicy(settings) {
    const { blockWriteAccess } = settings;

    if (typeof blockWriteAccess !== 'boolean') {
      return {
        success: false,
        error: {
          code: 'INVALID_SETTINGS',
          message: 'Invalid drive policy settings',
          details: 'blockWriteAccess must be a boolean value',
          recoverable: false
        }
      };
    }

    if (blockWriteAccess) {
      return await this.drivePolicy.blockWriteAccess();
    } else {
      return await this.drivePolicy.allowWriteAccess();
    }
  }

  /**
   * Apply browser policy settings (block/unblock all websites)
   * @private
   * @param {Object} settings - Browser policy settings
   * @param {boolean} settings.blockAllWebsites - Whether to block all websites
   * @returns {Promise<Object>} Result object
   */
  async _applyBrowserPolicy(settings) {
    const { blockAllWebsites } = settings;

    if (typeof blockAllWebsites !== 'boolean') {
      return {
        success: false,
        error: {
          code: 'INVALID_SETTINGS',
          message: 'Invalid browser policy settings',
          details: 'blockAllWebsites must be a boolean value',
          recoverable: false
        }
      };
    }

    if (blockAllWebsites) {
      return await this.browserPolicy.blockAllWebsites();
    } else {
      return await this.browserPolicy.unblockAllWebsites();
    }
  }

  /**
   * Apply whitelist policy settings (enable/disable whitelist mode)
   * @private
   * @param {Object} settings - Whitelist policy settings
   * @param {boolean} settings.enabled - Whether to enable whitelist mode
   * @param {Array<string>} settings.domains - Array of domains to whitelist (required if enabled)
   * @returns {Promise<Object>} Result object
   */
  async _applyWhitelistPolicy(settings) {
    const { enabled, domains } = settings;

    if (typeof enabled !== 'boolean') {
      return {
        success: false,
        error: {
          code: 'INVALID_SETTINGS',
          message: 'Invalid whitelist policy settings',
          details: 'enabled must be a boolean value',
          recoverable: false
        }
      };
    }

    if (enabled) {
      if (!Array.isArray(domains)) {
        return {
          success: false,
          error: {
            code: 'INVALID_SETTINGS',
            message: 'Invalid whitelist policy settings',
            details: 'domains must be an array when enabling whitelist',
            recoverable: false
          }
        };
      }

      if (domains.length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_SETTINGS',
            message: 'Invalid whitelist policy settings',
            details: 'At least one domain must be provided when enabling whitelist',
            recoverable: false
          }
        };
      }

      return await this.browserPolicy.enableWhitelist(domains);
    } else {
      return await this.browserPolicy.disableWhitelist();
    }
  }

  /**
   * Apply domain policy (add/remove individual domains)
   * @private
   * @param {Object} settings - Domain policy settings
   * @param {string} settings.action - Action to perform ('add' or 'remove')
   * @param {string} settings.domain - Domain to add or remove
   * @returns {Promise<Object>} Result object
   */
  async _applyDomainPolicy(settings) {
    const { action, domain } = settings;

    if (!action || !['add', 'remove'].includes(action)) {
      return {
        success: false,
        error: {
          code: 'INVALID_SETTINGS',
          message: 'Invalid domain policy settings',
          details: 'action must be either "add" or "remove"',
          recoverable: false
        }
      };
    }

    if (!domain || typeof domain !== 'string') {
      return {
        success: false,
        error: {
          code: 'INVALID_SETTINGS',
          message: 'Invalid domain policy settings',
          details: 'domain must be a non-empty string',
          recoverable: false
        }
      };
    }

    if (action === 'add') {
      return await this.browserPolicy.addDomain(domain);
    } else {
      return await this.browserPolicy.removeDomain(domain);
    }
  }
}

module.exports = PolicyManager;
