const { contextBridge, ipcRenderer } = require('electron');

/**
 * Validate input parameters to prevent injection attacks and ensure data integrity
 */
const validators = {
  isString: (value) => typeof value === 'string',
  isBoolean: (value) => typeof value === 'boolean',
  isObject: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  isNonEmptyString: (value) => typeof value === 'string' && value.trim().length > 0,
  isValidPasswordMethod: (method) => ['old', 'security', 'developer'].includes(method),
  isValidPasswordData: (method, data) => {
    if (!validators.isObject(data)) return false;
    
    switch (method) {
      case 'old':
        return validators.isNonEmptyString(data.oldPassword) && 
               validators.isNonEmptyString(data.newPassword);
      case 'security':
        return validators.isNonEmptyString(data.answer) && 
               validators.isNonEmptyString(data.newPassword);
      case 'developer':
        return validators.isNonEmptyString(data.key) && 
               validators.isNonEmptyString(data.newPassword);
      default:
        return false;
    }
  }
};

/**
 * Secure API exposed to renderer process with input validation
 * All methods use IPC invoke pattern for async request-response communication
 */
contextBridge.exposeInMainWorld('api', {
  // Authentication methods
  login: (username, password) => {
    if (!validators.isNonEmptyString(username) || !validators.isNonEmptyString(password)) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid input parameters',
          details: 'Username and password must be non-empty strings',
          recoverable: true
        }
      });
    }
    return ipcRenderer.invoke('auth:login', username, password);
  },

  logout: () => {
    return ipcRenderer.invoke('auth:logout');
  },

  changePassword: (method, data) => {
    if (!validators.isValidPasswordMethod(method)) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid password change method',
          details: 'Method must be one of: old, security, developer',
          recoverable: true
        }
      });
    }
    
    if (!validators.isValidPasswordData(method, data)) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid password change data',
          details: 'Required fields are missing or invalid for the selected method',
          recoverable: true
        }
      });
    }
    
    return ipcRenderer.invoke('auth:changePassword', method, data);
  },

  getSecurityQuestion: () => {
    return ipcRenderer.invoke('auth:getSecurityQuestion');
  },
  
  // Policy methods
  toggleDriveBlock: (enabled) => {
    if (!validators.isBoolean(enabled)) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid input parameter',
          details: 'Enabled parameter must be a boolean',
          recoverable: true
        }
      });
    }
    return ipcRenderer.invoke('policy:toggleDriveBlock', enabled);
  },

  toggleWebsiteBlock: (enabled) => {
    if (!validators.isBoolean(enabled)) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid input parameter',
          details: 'Enabled parameter must be a boolean',
          recoverable: true
        }
      });
    }
    return ipcRenderer.invoke('policy:toggleWebsiteBlock', enabled);
  },

  toggleWhitelist: (enabled) => {
    if (!validators.isBoolean(enabled)) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid input parameter',
          details: 'Enabled parameter must be a boolean',
          recoverable: true
        }
      });
    }
    return ipcRenderer.invoke('policy:toggleWhitelist', enabled);
  },
  
  // Domain management
  addDomain: (domain) => {
    if (!validators.isNonEmptyString(domain)) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid domain parameter',
          details: 'Domain must be a non-empty string',
          recoverable: true
        }
      });
    }
    return ipcRenderer.invoke('policy:addDomain', domain);
  },

  removeDomain: (domain) => {
    if (!validators.isNonEmptyString(domain)) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid domain parameter',
          details: 'Domain must be a non-empty string',
          recoverable: true
        }
      });
    }
    return ipcRenderer.invoke('policy:removeDomain', domain);
  },

  getDomains: () => {
    return ipcRenderer.invoke('policy:getDomains');
  },
  
  // Settings and status
  getStatus: () => {
    return ipcRenderer.invoke('settings:getStatus');
  },

  updateSettings: (settings) => {
    if (!validators.isObject(settings)) {
      return Promise.resolve({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid settings parameter',
          details: 'Settings must be an object',
          recoverable: true
        }
      });
    }
    return ipcRenderer.invoke('settings:updateSettings', settings);
  },

  // Navigation helper
  loadMainApp: () => {
    return ipcRenderer.invoke('navigation:loadMainApp');
  }
});
