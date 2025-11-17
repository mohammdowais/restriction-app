const { exec } = require('child_process');
const { promisify } = require('util');
const Logger = require('../utils/logger');
const PrivilegeChecker = require('../utils/privilegeChecker');

const execAsync = promisify(exec);

/**
 * BrowserPolicy - Manages browser website access policies via Windows Registry
 * Supports Chrome, Edge, and Firefox browsers
 */
class BrowserPolicy {
  constructor() {
    // Registry paths for different browsers
    this.browserPaths = {
      chrome: 'HKLM:\\SOFTWARE\\Policies\\Google\\Chrome',
      edge: 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge',
      firefox: 'HKLM:\\SOFTWARE\\Policies\\Mozilla\\Firefox'
    };

    // Domain validation regex - validates domain format
    this.domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  }

  /**
   * Block all websites across all browsers
   * @returns {Promise<Object>} Result object with success status and message
   */
  async blockAllWebsites() {
    try {
      Logger.info('Attempting to block all websites across all browsers', null, 'BrowserPolicy');

      // Verify administrator privileges
      const privilegeCheck = await PrivilegeChecker.verifyPrivilegesForOperation('Block All Websites');
      if (!privilegeCheck.success) {
        Logger.warn('Privilege check failed for blocking websites', privilegeCheck.error, 'BrowserPolicy');
        return privilegeCheck;
      }

      const results = [];

      // Block websites for each browser
      for (const [browser, path] of Object.entries(this.browserPaths)) {
        try {
          const blocklistPath = `${path}\\URLBlocklist`;
          
          // Create the policy path and URLBlocklist key if they don't exist
          // Then set blocking rule to block all URLs
          const command = `powershell -Command "` +
            `if (-not (Test-Path '${path}')) { ` +
            `New-Item -Path '${path}' -Force | Out-Null; ` +
            `}; ` +
            `if (-not (Test-Path '${blocklistPath}')) { ` +
            `New-Item -Path '${blocklistPath}' -Force | Out-Null; ` +
            `}; ` +
            `Set-ItemProperty -Path '${blocklistPath}' -Name '1' -Value '*' -Type String -Force"`;

          await execAsync(command, { shell: 'powershell.exe' });
          results.push({ browser, success: true });
          Logger.debug(`Blocked all websites for ${browser}`, null, 'BrowserPolicy');
        } catch (error) {
          Logger.error(`Failed to block websites for ${browser}`, error, 'BrowserPolicy');
          results.push({ browser, success: false, error: error.message });
        }
      }

      // Check if all browsers were successfully configured
      const allSuccess = results.every(r => r.success);
      const successCount = results.filter(r => r.success).length;

      if (allSuccess) {
        Logger.info('All websites blocked successfully across all browsers', { results }, 'BrowserPolicy');
      } else {
        Logger.warn(`Websites blocked for ${successCount} of ${results.length} browsers`, { results }, 'BrowserPolicy');
      }

      return {
        success: allSuccess,
        message: allSuccess 
          ? 'All websites have been blocked across all browsers'
          : `Websites blocked for ${successCount} of ${results.length} browsers`,
        results: results,
        status: 'blocked'
      };
    } catch (error) {
      return this._handlePolicyError(error, 'block all websites');
    }
  }

  /**
   * Unblock all websites by removing blocking policies
   * @returns {Promise<Object>} Result object with success status and message
   */
  async unblockAllWebsites() {
    try {
      Logger.info('Attempting to unblock all websites across all browsers', null, 'BrowserPolicy');

      // Verify administrator privileges
      const privilegeCheck = await PrivilegeChecker.verifyPrivilegesForOperation('Unblock All Websites');
      if (!privilegeCheck.success) {
        Logger.warn('Privilege check failed for unblocking websites', privilegeCheck.error, 'BrowserPolicy');
        return privilegeCheck;
      }

      const results = [];

      // Remove blocking policies for each browser
      for (const [browser, path] of Object.entries(this.browserPaths)) {
        try {
          const blocklistPath = `${path}\\URLBlocklist`;
          
          // Remove the URLBlocklist key if it exists
          const command = `powershell -Command "` +
            `if (Test-Path '${blocklistPath}') { ` +
            `Remove-Item -Path '${blocklistPath}' -Recurse -Force; ` +
            `}"`;

          await execAsync(command, { shell: 'powershell.exe' });
          results.push({ browser, success: true });
          Logger.debug(`Unblocked websites for ${browser}`, null, 'BrowserPolicy');
        } catch (error) {
          Logger.error(`Failed to unblock websites for ${browser}`, error, 'BrowserPolicy');
          results.push({ browser, success: false, error: error.message });
        }
      }

      const allSuccess = results.every(r => r.success);
      const successCount = results.filter(r => r.success).length;

      if (allSuccess) {
        Logger.info('All websites unblocked successfully across all browsers', { results }, 'BrowserPolicy');
      } else {
        Logger.warn(`Websites unblocked for ${successCount} of ${results.length} browsers`, { results }, 'BrowserPolicy');
      }

      return {
        success: allSuccess,
        message: allSuccess 
          ? 'All websites have been unblocked across all browsers'
          : `Websites unblocked for ${successCount} of ${results.length} browsers`,
        results: results,
        status: 'unblocked'
      };
    } catch (error) {
      return this._handlePolicyError(error, 'unblock all websites');
    }
  }

  /**
   * Enable domain whitelist mode - only allow access to specified domains
   * @param {Array<string>} domains - Array of domains to whitelist
   * @returns {Promise<Object>} Result object with success status and message
   */
  async enableWhitelist(domains) {
    try {
      Logger.info('Attempting to enable domain whitelist', { domainCount: domains.length }, 'BrowserPolicy');

      // Verify administrator privileges
      const privilegeCheck = await PrivilegeChecker.verifyPrivilegesForOperation('Enable Domain Whitelist');
      if (!privilegeCheck.success) {
        Logger.warn('Privilege check failed for enabling whitelist', privilegeCheck.error, 'BrowserPolicy');
        return privilegeCheck;
      }

      // Validate all domains
      const invalidDomains = domains.filter(domain => !this.validateDomain(domain));
      if (invalidDomains.length > 0) {
        Logger.warn('Invalid domains detected', { invalidDomains }, 'BrowserPolicy');
        return {
          success: false,
          error: {
            code: 'INVALID_DOMAIN_FORMAT',
            message: 'Invalid domain format',
            details: `The following domains have invalid format: ${invalidDomains.join(', ')}`,
            recoverable: true,
            invalidDomains: invalidDomains
          }
        };
      }

      const results = [];

      // Apply whitelist for each browser
      for (const [browser, path] of Object.entries(this.browserPaths)) {
        try {
          const blocklistPath = `${path}\\URLBlocklist`;
          const allowlistPath = `${path}\\URLAllowlist`;
          
          // First, block all websites
          let command = `powershell -Command "` +
            `if (-not (Test-Path '${path}')) { ` +
            `New-Item -Path '${path}' -Force | Out-Null; ` +
            `}; ` +
            `if (-not (Test-Path '${blocklistPath}')) { ` +
            `New-Item -Path '${blocklistPath}' -Force | Out-Null; ` +
            `}; ` +
            `Set-ItemProperty -Path '${blocklistPath}' -Name '1' -Value '*' -Type String -Force"`;

          await execAsync(command, { shell: 'powershell.exe' });

          // Then, create allowlist with specified domains
          command = `powershell -Command "` +
            `if (-not (Test-Path '${allowlistPath}')) { ` +
            `New-Item -Path '${allowlistPath}' -Force | Out-Null; ` +
            `}"`;

          await execAsync(command, { shell: 'powershell.exe' });

          // Add each domain to the allowlist
          for (let i = 0; i < domains.length; i++) {
            const domain = domains[i];
            command = `powershell -Command "` +
              `Set-ItemProperty -Path '${allowlistPath}' -Name '${i + 1}' -Value '${domain}' -Type String -Force"`;
            
            await execAsync(command, { shell: 'powershell.exe' });
          }

          results.push({ browser, success: true, domainCount: domains.length });
          Logger.debug(`Enabled whitelist for ${browser} with ${domains.length} domains`, null, 'BrowserPolicy');
        } catch (error) {
          Logger.error(`Failed to enable whitelist for ${browser}`, error, 'BrowserPolicy');
          results.push({ browser, success: false, error: error.message });
        }
      }

      const allSuccess = results.every(r => r.success);
      const successCount = results.filter(r => r.success).length;

      if (allSuccess) {
        Logger.info(`Domain whitelist enabled successfully with ${domains.length} domains`, { results }, 'BrowserPolicy');
      } else {
        Logger.warn(`Whitelist enabled for ${successCount} of ${results.length} browsers`, { results }, 'BrowserPolicy');
      }

      return {
        success: allSuccess,
        message: allSuccess 
          ? `Domain whitelist enabled with ${domains.length} domains`
          : `Whitelist enabled for ${successCount} of ${results.length} browsers`,
        results: results,
        status: 'whitelist_enabled',
        domainCount: domains.length
      };
    } catch (error) {
      return this._handlePolicyError(error, 'enable domain whitelist');
    }
  }

  /**
   * Disable domain whitelist mode - remove all whitelist policies
   * @returns {Promise<Object>} Result object with success status and message
   */
  async disableWhitelist() {
    try {
      Logger.info('Attempting to disable domain whitelist', null, 'BrowserPolicy');

      // Verify administrator privileges
      const privilegeCheck = await PrivilegeChecker.verifyPrivilegesForOperation('Disable Domain Whitelist');
      if (!privilegeCheck.success) {
        Logger.warn('Privilege check failed for disabling whitelist', privilegeCheck.error, 'BrowserPolicy');
        return privilegeCheck;
      }

      const results = [];

      // Remove whitelist and blocklist for each browser
      for (const [browser, path] of Object.entries(this.browserPaths)) {
        try {
          const blocklistPath = `${path}\\URLBlocklist`;
          const allowlistPath = `${path}\\URLAllowlist`;
          
          // Remove both blocklist and allowlist keys
          const command = `powershell -Command "` +
            `if (Test-Path '${blocklistPath}') { ` +
            `Remove-Item -Path '${blocklistPath}' -Recurse -Force; ` +
            `}; ` +
            `if (Test-Path '${allowlistPath}') { ` +
            `Remove-Item -Path '${allowlistPath}' -Recurse -Force; ` +
            `}"`;

          await execAsync(command, { shell: 'powershell.exe' });
          results.push({ browser, success: true });
          Logger.debug(`Disabled whitelist for ${browser}`, null, 'BrowserPolicy');
        } catch (error) {
          Logger.error(`Failed to disable whitelist for ${browser}`, error, 'BrowserPolicy');
          results.push({ browser, success: false, error: error.message });
        }
      }

      const allSuccess = results.every(r => r.success);
      const successCount = results.filter(r => r.success).length;

      if (allSuccess) {
        Logger.info('Domain whitelist disabled successfully', { results }, 'BrowserPolicy');
      } else {
        Logger.warn(`Whitelist disabled for ${successCount} of ${results.length} browsers`, { results }, 'BrowserPolicy');
      }

      return {
        success: allSuccess,
        message: allSuccess 
          ? 'Domain whitelist has been disabled'
          : `Whitelist disabled for ${successCount} of ${results.length} browsers`,
        results: results,
        status: 'whitelist_disabled'
      };
    } catch (error) {
      return this._handlePolicyError(error, 'disable domain whitelist');
    }
  }

  /**
   * Add a domain to the whitelist
   * @param {string} domain - Domain to add
   * @returns {Promise<Object>} Result object with success status and message
   */
  async addDomain(domain) {
    try {
      Logger.info(`Attempting to add domain to whitelist: ${domain}`, null, 'BrowserPolicy');

      // Validate domain format
      if (!this.validateDomain(domain)) {
        Logger.warn(`Invalid domain format: ${domain}`, null, 'BrowserPolicy');
        return {
          success: false,
          error: {
            code: 'INVALID_DOMAIN_FORMAT',
            message: 'Invalid domain format',
            details: `The domain "${domain}" has an invalid format. Please use a valid domain name (e.g., example.com)`,
            recoverable: true
          }
        };
      }

      // Verify administrator privileges
      const privilegeCheck = await PrivilegeChecker.verifyPrivilegesForOperation('Add Domain to Whitelist');
      if (!privilegeCheck.success) {
        Logger.warn('Privilege check failed for adding domain', privilegeCheck.error, 'BrowserPolicy');
        return privilegeCheck;
      }

      // Get current domain list
      const currentDomains = await this.getDomainList();
      if (!currentDomains.success) {
        return currentDomains;
      }

      // Check if domain already exists
      if (currentDomains.domains.includes(domain)) {
        Logger.debug(`Domain already exists in whitelist: ${domain}`, null, 'BrowserPolicy');
        return {
          success: true,
          message: `Domain "${domain}" is already in the whitelist`,
          status: 'already_exists'
        };
      }

      // Add domain to the list
      const updatedDomains = [...currentDomains.domains, domain];
      
      Logger.info(`Adding domain to whitelist: ${domain}`, { totalDomains: updatedDomains.length }, 'BrowserPolicy');
      
      // Re-enable whitelist with updated domain list
      return await this.enableWhitelist(updatedDomains);
    } catch (error) {
      return this._handlePolicyError(error, 'add domain to whitelist');
    }
  }

  /**
   * Remove a domain from the whitelist
   * @param {string} domain - Domain to remove
   * @returns {Promise<Object>} Result object with success status and message
   */
  async removeDomain(domain) {
    try {
      Logger.info(`Attempting to remove domain from whitelist: ${domain}`, null, 'BrowserPolicy');

      // Verify administrator privileges
      const privilegeCheck = await PrivilegeChecker.verifyPrivilegesForOperation('Remove Domain from Whitelist');
      if (!privilegeCheck.success) {
        Logger.warn('Privilege check failed for removing domain', privilegeCheck.error, 'BrowserPolicy');
        return privilegeCheck;
      }

      // Get current domain list
      const currentDomains = await this.getDomainList();
      if (!currentDomains.success) {
        return currentDomains;
      }

      // Check if domain exists
      if (!currentDomains.domains.includes(domain)) {
        Logger.debug(`Domain not found in whitelist: ${domain}`, null, 'BrowserPolicy');
        return {
          success: true,
          message: `Domain "${domain}" is not in the whitelist`,
          status: 'not_found'
        };
      }

      // Remove domain from the list
      const updatedDomains = currentDomains.domains.filter(d => d !== domain);
      
      Logger.info(`Removing domain from whitelist: ${domain}`, { remainingDomains: updatedDomains.length }, 'BrowserPolicy');
      
      // If no domains left, disable whitelist
      if (updatedDomains.length === 0) {
        Logger.info('No domains remaining, disabling whitelist', null, 'BrowserPolicy');
        return await this.disableWhitelist();
      }

      // Re-enable whitelist with updated domain list
      return await this.enableWhitelist(updatedDomains);
    } catch (error) {
      return this._handlePolicyError(error, 'remove domain from whitelist');
    }
  }

  /**
   * Get the current list of whitelisted domains
   * @returns {Promise<Object>} Result object with array of domains
   */
  async getDomainList() {
    try {
      Logger.debug('Retrieving domain whitelist', null, 'BrowserPolicy');

      // Read domains from Chrome registry (use as source of truth)
      const allowlistPath = `${this.browserPaths.chrome}\\URLAllowlist`;
      
      const command = `powershell -Command "` +
        `if (Test-Path '${allowlistPath}') { ` +
        `$props = Get-ItemProperty -Path '${allowlistPath}' -ErrorAction SilentlyContinue; ` +
        `if ($props) { ` +
        `$props.PSObject.Properties | Where-Object { $_.Name -match '^\\d+$' } | ForEach-Object { $_.Value }; ` +
        `} ` +
        `}"`;

      const { stdout } = await execAsync(command, { shell: 'powershell.exe' });
      
      const domains = stdout
        .trim()
        .split('\n')
        .map(d => d.trim())
        .filter(d => d.length > 0);

      Logger.debug(`Retrieved ${domains.length} domains from whitelist`, { domains }, 'BrowserPolicy');

      return {
        success: true,
        domains: domains,
        count: domains.length
      };
    } catch (error) {
      // If error reading, return empty list (whitelist not configured)
      Logger.debug('No whitelist configured or error reading domains', null, 'BrowserPolicy');
      return {
        success: true,
        domains: [],
        count: 0
      };
    }
  }

  /**
   * Validate domain format using regex
   * @param {string} domain - Domain to validate
   * @returns {boolean} True if domain is valid
   */
  validateDomain(domain) {
    if (!domain || typeof domain !== 'string') {
      return false;
    }

    // Remove protocol if present
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    
    // Check against regex
    return this.domainRegex.test(cleanDomain);
  }

  /**
   * Handle policy operation errors with structured error responses
   * @private
   * @param {Error} error - The error object
   * @param {string} operation - Description of the operation that failed
   * @returns {Object} Structured error response
   */
  _handlePolicyError(error, operation) {
    Logger.error(`Failed to ${operation}`, error, 'BrowserPolicy');

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
          details: `Cannot ${operation}: Administrator privileges are required to modify browser policies.`,
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

module.exports = BrowserPolicy;
