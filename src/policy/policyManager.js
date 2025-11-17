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
      Logger.debug(`Applying policy: ${policyType}`, settings, 'PolicyManager');

      // Verify administrator privileges before any policy modification
      const privilegeCheck = await PrivilegeChecker.verifyPrivilegesForOperation(`Apply ${policyType} policy`);
      if (!privilegeCheck.success) {
        Logger.warn(`Privilege check failed for policy: ${policyType}`, privilegeCheck.error, 'PolicyManager');
        return privilegeCheck;
      }

      let result;
      let action = 'apply';

      switch (policyType) {
        case 'drive':
          action = settings.blockWriteAccess ? 'block' : 'allow';
          result = await this._applyDrivePolicy(settings);
          break;

        case 'browser':
          action = settings.blockAllWebsites ? 'block' : 'unblock';
          result = await this._applyBrowserPolicy(settings);
          break;

        case 'whitelist':
          action = settings.enabled ? 'enable' : 'disable';
          result = await this._applyWhitelistPolicy(settings);
          break;

        case 'domain':
          action = settings.action;
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

      // Log policy change
      Logger.logPolicyChange(policyType, action, result.success, result.error || result);

      return result;
    } catch (error) {
      Logger.error(`Error applying policy: ${policyType}`, error, 'PolicyManager');
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
      Logger.debug('Retrieving current policy status', null, 'PolicyManager');

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

      Logger.debug('Policy status retrieved successfully', status, 'PolicyManager');
      return status;
    } catch (error) {
      Logger.error('Error retrieving policy status', error, 'PolicyManager');
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

  /**
   * Synchronize policy states with actual Group Policy settings
   * This method queries the actual registry settings and returns the true state
   * @returns {Promise<Object>} Synchronized policy states
   */
  async syncPolicyStates() {
    try {
      Logger.debug('Synchronizing policy states with actual Group Policy settings', null, 'PolicyManager');

      // Get actual policy status from the system
      const driveStatus = await this.drivePolicy.getWriteAccessStatus();
      const domainList = await this.browserPolicy.getDomainList();

      const syncedStates = {
        success: true,
        states: {
          driveBlock: driveStatus.success ? driveStatus.isBlocked : false,
          websiteBlock: false, // Website blocking is determined by whitelist presence
          whitelist: domainList.success && domainList.count > 0,
          lastSynced: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      Logger.info('Policy states synchronized successfully', syncedStates.states, 'PolicyManager');
      return syncedStates;
    } catch (error) {
      Logger.error('Error synchronizing policy states', error, 'PolicyManager');
      return {
        success: false,
        error: {
          code: 'SYNC_ERROR',
          message: 'Failed to synchronize policy states',
          details: error.message || 'An unexpected error occurred while synchronizing policy states',
          recoverable: true,
          originalError: error.toString()
        }
      };
    }
  }

  /**
   * Reset all policies to default state
   * @returns {Promise<Object>} Result object
   */
  async resetAllPolicies() {
    try {
      Logger.info('Resetting all policies to default state', null, 'PolicyManager');

      // Verify administrator privileges
      const privilegeCheck = await PrivilegeChecker.verifyPrivilegesForOperation('Reset all policies');
      if (!privilegeCheck.success) {
        Logger.warn('Privilege check failed for reset all policies', privilegeCheck.error, 'PolicyManager');
        return privilegeCheck;
      }

      const results = {
        drive: null,
        browser: null,
        whitelist: null
      };

      // Reset drive policy
      results.drive = await this.drivePolicy.allowWriteAccess();
      if (!results.drive.success) {
        Logger.warn('Failed to reset drive policy', results.drive.error, 'PolicyManager');
      }

      // Reset browser policy
      results.browser = await this.browserPolicy.unblockAllWebsites();
      if (!results.browser.success) {
        Logger.warn('Failed to reset browser policy', results.browser.error, 'PolicyManager');
      }

      // Reset whitelist
      results.whitelist = await this.browserPolicy.disableWhitelist();
      if (!results.whitelist.success) {
        Logger.warn('Failed to reset whitelist policy', results.whitelist.error, 'PolicyManager');
      }

      // Check if all operations succeeded
      const allSucceeded = results.drive.success && results.browser.success && results.whitelist.success;

      if (allSucceeded) {
        Logger.info('All policies reset successfully', null, 'PolicyManager');
        return {
          success: true,
          message: 'All policies have been reset to default state',
          results: results
        };
      } else {
        Logger.warn('Some policies failed to reset', results, 'PolicyManager');
        return {
          success: false,
          error: {
            code: 'PARTIAL_RESET_FAILURE',
            message: 'Some policies could not be reset',
            details: 'One or more policy reset operations failed. Check individual results for details.',
            recoverable: true
          },
          results: results
        };
      }
    } catch (error) {
      Logger.error('Error resetting policies', error, 'PolicyManager');
      return {
        success: false,
        error: {
          code: 'RESET_ERROR',
          message: 'Failed to reset policies',
          details: error.message || 'An unexpected error occurred while resetting policies',
          recoverable: false,
          originalError: error.toString()
        }
      };
    }
  }
}

module.exports = PolicyManager;
