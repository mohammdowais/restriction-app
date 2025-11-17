/**
 * Data Models for Group Policy Manager
 * Defines the structure for User Credentials and Application Settings
 */

/**
 * User Credentials Model
 * Stores authentication and security information
 */
class UserCredentials {
  constructor(data = {}) {
    this.username = data.username || 'admin';
    this.passwordHash = data.passwordHash || null;
    this.securityQuestion = data.securityQuestion || null; // Encrypted
    this.securityAnswerHash = data.securityAnswerHash || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.lastModified = data.lastModified || new Date().toISOString();
  }

  /**
   * Validate credentials structure
   */
  validate() {
    if (!this.username || typeof this.username !== 'string') {
      throw new Error('Invalid username');
    }
    if (!this.passwordHash || typeof this.passwordHash !== 'string') {
      throw new Error('Invalid password hash');
    }
    return true;
  }

  /**
   * Convert to plain object for storage
   */
  toJSON() {
    return {
      username: this.username,
      passwordHash: this.passwordHash,
      securityQuestion: this.securityQuestion,
      securityAnswerHash: this.securityAnswerHash,
      createdAt: this.createdAt,
      lastModified: this.lastModified
    };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data) {
    return new UserCredentials(data);
  }
}

/**
 * Application Settings Model
 * Stores policy configuration and state
 */
class ApplicationSettings {
  constructor(data = {}) {
    this.driveBlockEnabled = data.driveBlockEnabled || false;
    this.websiteBlockEnabled = data.websiteBlockEnabled || false;
    this.whitelistEnabled = data.whitelistEnabled || false;
    this.whitelistedDomains = data.whitelistedDomains || [];
    this.lastUpdated = data.lastUpdated || new Date().toISOString();
  }

  /**
   * Validate settings structure
   */
  validate() {
    if (typeof this.driveBlockEnabled !== 'boolean') {
      throw new Error('Invalid driveBlockEnabled value');
    }
    if (typeof this.websiteBlockEnabled !== 'boolean') {
      throw new Error('Invalid websiteBlockEnabled value');
    }
    if (typeof this.whitelistEnabled !== 'boolean') {
      throw new Error('Invalid whitelistEnabled value');
    }
    if (!Array.isArray(this.whitelistedDomains)) {
      throw new Error('Invalid whitelistedDomains value');
    }
    return true;
  }

  /**
   * Add domain to whitelist
   */
  addDomain(domain) {
    if (!this.whitelistedDomains.includes(domain)) {
      this.whitelistedDomains.push(domain);
      this.lastUpdated = new Date().toISOString();
    }
  }

  /**
   * Remove domain from whitelist
   */
  removeDomain(domain) {
    const index = this.whitelistedDomains.indexOf(domain);
    if (index > -1) {
      this.whitelistedDomains.splice(index, 1);
      this.lastUpdated = new Date().toISOString();
    }
  }

  /**
   * Convert to plain object for storage
   */
  toJSON() {
    return {
      driveBlockEnabled: this.driveBlockEnabled,
      websiteBlockEnabled: this.websiteBlockEnabled,
      whitelistEnabled: this.whitelistEnabled,
      whitelistedDomains: [...this.whitelistedDomains],
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data) {
    return new ApplicationSettings(data);
  }
}

/**
 * Policy Status Model
 * Represents the current state of applied policies
 */
class PolicyStatus {
  constructor(data = {}) {
    this.driveWriteBlocked = data.driveWriteBlocked || false;
    this.allWebsitesBlocked = data.allWebsitesBlocked || false;
    this.whitelistActive = data.whitelistActive || false;
    this.activeDomains = data.activeDomains || [];
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return {
      driveWriteBlocked: this.driveWriteBlocked,
      allWebsitesBlocked: this.allWebsitesBlocked,
      whitelistActive: this.whitelistActive,
      activeDomains: [...this.activeDomains]
    };
  }

  /**
   * Create from plain object
   */
  static fromJSON(data) {
    return new PolicyStatus(data);
  }
}

module.exports = {
  UserCredentials,
  ApplicationSettings,
  PolicyStatus
};
