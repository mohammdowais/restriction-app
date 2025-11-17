const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const bcrypt = require('bcrypt');

class DataStore {
  constructor(dataPath = null) {
    this.dataPath = dataPath || path.join(os.homedir(), '.gpm-data.enc');
    this.encryptionKey = this.generateMachineKey();
    this.algorithm = 'aes-256-cbc';
    this.data = null;
  }

  /**
   * Generate a machine-specific encryption key based on hardware identifiers
   */
  generateMachineKey() {
    const machineId = os.hostname() + os.platform() + os.arch();
    return crypto.createHash('sha256').update(machineId).digest();
  }

  /**
   * Encrypt data using AES-256-CBC
   */
  encrypt(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt data using AES-256-CBC
   */
  decrypt(encryptedData) {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  /**
   * Load encrypted data from file
   */
  async load() {
    try {
      const encryptedData = await fs.readFile(this.dataPath, 'utf8');
      this.data = this.decrypt(encryptedData);
      return this.data;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, initialize with default data
        this.data = await this.initializeDefaultData();
        await this.save(this.data);
        return this.data;
      }
      throw new Error(`Failed to load data: ${error.message}`);
    }
  }

  /**
   * Save encrypted data to file
   */
  async save(data) {
    try {
      this.data = data;
      const encryptedData = this.encrypt(data);
      await fs.writeFile(this.dataPath, encryptedData, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save data: ${error.message}`);
    }
  }

  /**
   * Initialize default data with admin/admin credentials
   */
  async initializeDefaultData() {
    const defaultPassword = 'admin';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    
    // Generate developer key
    const developerKey = crypto.randomBytes(32).toString('hex');
    const encryptedDeveloperKey = this.encryptString(developerKey);
    
    return {
      credentials: {
        username: 'admin',
        passwordHash: passwordHash,
        securityQuestion: null,
        securityAnswerHash: null,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      },
      developerKey: encryptedDeveloperKey,
      settings: {
        driveBlockEnabled: false,
        websiteBlockEnabled: false,
        whitelistEnabled: false,
        whitelistedDomains: [],
        lastUpdated: new Date().toISOString()
      },
      toggleStates: {
        driveBlock: false,
        websiteBlock: false,
        whitelist: false,
        lastSynced: null
      }
    };
  }

  /**
   * Encrypt a single string value
   */
  encryptString(str) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(str, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt a single string value
   */
  decryptString(encryptedStr) {
    const parts = encryptedStr.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Get credentials
   */
  async getCredentials() {
    if (!this.data) {
      await this.load();
    }
    return this.data.credentials;
  }

  /**
   * Update credentials
   */
  async updateCredentials(credentials) {
    if (!this.data) {
      await this.load();
    }
    this.data.credentials = {
      ...this.data.credentials,
      ...credentials,
      lastModified: new Date().toISOString()
    };
    await this.save(this.data);
  }

  /**
   * Get settings
   */
  async getSettings() {
    if (!this.data) {
      await this.load();
    }
    return this.data.settings;
  }

  /**
   * Update settings
   */
  async updateSettings(settings) {
    if (!this.data) {
      await this.load();
    }
    this.data.settings = {
      ...this.data.settings,
      ...settings,
      lastUpdated: new Date().toISOString()
    };
    await this.save(this.data);
  }

  /**
   * Get developer key (decrypted)
   */
  async getDeveloperKey() {
    if (!this.data) {
      await this.load();
    }
    return this.decryptString(this.data.developerKey);
  }

  /**
   * Update developer key
   */
  async updateDeveloperKey(newKey) {
    if (!this.data) {
      await this.load();
    }
    this.data.developerKey = this.encryptString(newKey);
    await this.save(this.data);
  }

  /**
   * Get toggle states
   */
  async getToggleStates() {
    if (!this.data) {
      await this.load();
    }
    // Ensure toggleStates exists for backward compatibility
    if (!this.data.toggleStates) {
      this.data.toggleStates = {
        driveBlock: false,
        websiteBlock: false,
        whitelist: false,
        lastSynced: null
      };
    }
    return this.data.toggleStates;
  }

  /**
   * Update toggle states
   */
  async updateToggleStates(toggleStates) {
    if (!this.data) {
      await this.load();
    }
    this.data.toggleStates = {
      ...this.data.toggleStates,
      ...toggleStates
    };
    await this.save(this.data);
  }
}

module.exports = DataStore;
