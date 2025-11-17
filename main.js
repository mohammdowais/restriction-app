const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import application services
const DataStore = require('./src/storage/dataStore');
const AuthManager = require('./src/auth/authManager');
const PasswordManager = require('./src/auth/passwordManager');
const PolicyManager = require('./src/policy/policyManager');
const PrivilegeChecker = require('./src/utils/privilegeChecker');
const Logger = require('./src/utils/logger');

let mainWindow;
let dataStore;
let authManager;
let passwordManager;
let policyManager;

/**
 * Initialize application services
 */
async function initializeServices() {
  try {
    Logger.info('Initializing application services...', null, 'Application');
    
    // Initialize data store and load data
    dataStore = new DataStore();
    await dataStore.load();
    
    // Initialize managers
    authManager = new AuthManager(dataStore);
    passwordManager = new PasswordManager(dataStore);
    policyManager = new PolicyManager();
    
    Logger.info('Application services initialized successfully', null, 'Application');
    
    // Check for admin privileges on startup
    const privilegeCheck = await PrivilegeChecker.checkAdminPrivileges();
    if (!privilegeCheck.hasPrivileges) {
      Logger.warn('Application is not running with administrator privileges', null, 'Application');
      Logger.warn('Some features may not work correctly', null, 'Application');
      
      // Display privilege warning to user
      const { dialog } = require('electron');
      setTimeout(() => {
        if (mainWindow) {
          dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Administrator Privileges Required',
            message: 'Administrator Privileges Required',
            detail: 'This application requires administrator privileges to modify Group Policy settings. Some features may not work correctly without elevated permissions.\n\nPlease restart the application as administrator.',
            buttons: ['OK']
          });
        }
      }, 1000); // Delay to ensure window is created
    } else {
      Logger.info('Application is running with administrator privileges', null, 'Application');
    }
  } catch (error) {
    Logger.error('Failed to initialize application services', error, 'Application');
    throw error;
  }
}

/**
 * Register all IPC handlers for communication with renderer process
 */
function registerIpcHandlers() {
  Logger.debug('Registering IPC handlers...', null, 'Application');
  
  // ===== Authentication Handlers =====
  
  /**
   * Handle login authentication request
   */
  ipcMain.handle('auth:login', async (event, username, password) => {
    try {
      const result = await authManager.authenticate(username, password);
      return result;
    } catch (error) {
      Logger.error('Login error', error, 'IPC');
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
  });
  
  /**
   * Handle logout request
   */
  ipcMain.handle('auth:logout', async (event) => {
    try {
      const result = await authManager.logout();
      return result;
    } catch (error) {
      Logger.error('Logout error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: 'Logout failed',
          details: error.message,
          recoverable: false
        }
      };
    }
  });
  
  /**
   * Handle password change request with multiple methods
   */
  ipcMain.handle('auth:changePassword', async (event, method, data) => {
    try {
      Logger.debug(`Password change request using method: ${method}`, null, 'IPC');
      
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to change password',
            recoverable: true
          }
        };
      }
      
      let result;
      
      switch (method) {
        case 'old':
          result = await passwordManager.changePasswordWithOld(data.oldPassword, data.newPassword);
          break;
        case 'security':
          result = await passwordManager.changePasswordWithSecurityQuestion(data.answer, data.newPassword);
          break;
        case 'developer':
          result = await passwordManager.changePasswordWithDeveloperKey(data.key, data.newPassword);
          break;
        default:
          result = {
            success: false,
            error: {
              code: 'INVALID_METHOD',
              message: 'Invalid password change method',
              details: `Unknown method: ${method}`,
              recoverable: false
            }
          };
      }
      
      if (result.success) {
        Logger.info(`Password changed successfully using method: ${method}`, null, 'IPC');
      } else {
        Logger.warn(`Password change failed using method: ${method}`, result.error, 'IPC');
      }
      
      return result;
    } catch (error) {
      Logger.error('Password change error', error, 'IPC');
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
  });
  
  /**
   * Handle get security question request
   */
  ipcMain.handle('auth:getSecurityQuestion', async (event) => {
    try {
      const question = await passwordManager.getSecurityQuestion();
      
      return {
        success: true,
        question: question
      };
    } catch (error) {
      Logger.error('Get security question error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'SECURITY_QUESTION_ERROR',
          message: 'Failed to retrieve security question',
          details: error.message,
          recoverable: false
        }
      };
    }
  });

  /**
   * Handle setup security question request
   */
  ipcMain.handle('auth:setupSecurityQuestion', async (event, question, answer) => {
    try {
      Logger.debug('Security question setup request', null, 'IPC');
      
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to setup security question',
            recoverable: true
          }
        };
      }
      
      const result = await passwordManager.setSecurityQuestion(question, answer);
      
      if (result.success) {
        Logger.info('Security question setup successfully', null, 'IPC');
      } else {
        Logger.warn('Security question setup failed', result.error, 'IPC');
      }
      
      return result;
    } catch (error) {
      Logger.error('Setup security question error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'SECURITY_QUESTION_ERROR',
          message: 'Failed to setup security question',
          details: error.message,
          recoverable: false
        }
      };
    }
  });
  
  // ===== Policy Handlers =====
  
  /**
   * Handle toggle drive block request
   */
  ipcMain.handle('policy:toggleDriveBlock', async (event, enabled) => {
    try {
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to modify policies',
            recoverable: true
          }
        };
      }
      
      const result = await policyManager.applyPolicy('drive', {
        blockWriteAccess: enabled
      });
      
      // Update settings and toggle states in data store
      if (result.success) {
        await dataStore.updateSettings({
          driveBlockEnabled: enabled
        });
        
        await dataStore.updateToggleStates({
          driveBlock: enabled
        });
      }
      
      return result;
    } catch (error) {
      Logger.error('Toggle drive block error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'POLICY_ERROR',
          message: 'Failed to toggle drive block',
          details: error.message,
          recoverable: false
        }
      };
    }
  });
  
  /**
   * Handle toggle website block request
   */
  ipcMain.handle('policy:toggleWebsiteBlock', async (event, enabled) => {
    try {
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to modify policies',
            recoverable: true
          }
        };
      }
      
      const result = await policyManager.applyPolicy('browser', {
        blockAllWebsites: enabled
      });
      
      // Update settings and toggle states in data store
      if (result.success) {
        await dataStore.updateSettings({
          websiteBlockEnabled: enabled
        });
        
        await dataStore.updateToggleStates({
          websiteBlock: enabled
        });
      }
      
      return result;
    } catch (error) {
      Logger.error('Toggle website block error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'POLICY_ERROR',
          message: 'Failed to toggle website block',
          details: error.message,
          recoverable: false
        }
      };
    }
  });
  
  /**
   * Handle toggle whitelist request
   */
  ipcMain.handle('policy:toggleWhitelist', async (event, enabled) => {
    try {
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to modify policies',
            recoverable: true
          }
        };
      }
      
      // Get current domain list from settings
      const settings = await dataStore.getSettings();
      const domains = settings.whitelistedDomains || [];
      
      const result = await policyManager.applyPolicy('whitelist', {
        enabled: enabled,
        domains: domains
      });
      
      // Update settings and toggle states in data store
      if (result.success) {
        await dataStore.updateSettings({
          whitelistEnabled: enabled
        });
        
        await dataStore.updateToggleStates({
          whitelist: enabled
        });
      }
      
      return result;
    } catch (error) {
      Logger.error('Toggle whitelist error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'POLICY_ERROR',
          message: 'Failed to toggle whitelist',
          details: error.message,
          recoverable: false
        }
      };
    }
  });
  
  /**
   * Handle add domain request
   */
  ipcMain.handle('policy:addDomain', async (event, domain) => {
    try {
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to modify policies',
            recoverable: true
          }
        };
      }
      
      const result = await policyManager.applyPolicy('domain', {
        action: 'add',
        domain: domain
      });
      
      // Update settings in data store
      if (result.success) {
        const settings = await dataStore.getSettings();
        const domains = settings.whitelistedDomains || [];
        
        if (!domains.includes(domain)) {
          domains.push(domain);
          await dataStore.updateSettings({
            whitelistedDomains: domains
          });
        }
      }
      
      return result;
    } catch (error) {
      Logger.error('Add domain error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'POLICY_ERROR',
          message: 'Failed to add domain',
          details: error.message,
          recoverable: false
        }
      };
    }
  });
  
  /**
   * Handle remove domain request
   */
  ipcMain.handle('policy:removeDomain', async (event, domain) => {
    try {
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to modify policies',
            recoverable: true
          }
        };
      }
      
      const result = await policyManager.applyPolicy('domain', {
        action: 'remove',
        domain: domain
      });
      
      // Update settings in data store
      if (result.success) {
        const settings = await dataStore.getSettings();
        const domains = settings.whitelistedDomains || [];
        
        const updatedDomains = domains.filter(d => d !== domain);
        await dataStore.updateSettings({
          whitelistedDomains: updatedDomains
        });
      }
      
      return result;
    } catch (error) {
      Logger.error('Remove domain error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'POLICY_ERROR',
          message: 'Failed to remove domain',
          details: error.message,
          recoverable: false
        }
      };
    }
  });
  
  /**
   * Handle get domains request
   */
  ipcMain.handle('policy:getDomains', async (event) => {
    try {
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to view policies',
            recoverable: true
          }
        };
      }
      
      const settings = await dataStore.getSettings();
      
      return {
        success: true,
        domains: settings.whitelistedDomains || [],
        count: (settings.whitelistedDomains || []).length
      };
    } catch (error) {
      Logger.error('Get domains error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'DATA_ERROR',
          message: 'Failed to retrieve domains',
          details: error.message,
          recoverable: false
        }
      };
    }
  });

  /**
   * Handle get whitelisted domains request
   */
  ipcMain.handle('policy:getWhitelistedDomains', async (event) => {
    try {
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to view policies',
            recoverable: true
          }
        };
      }
      
      const settings = await dataStore.getSettings();
      
      return {
        success: true,
        domains: settings.whitelistedDomains || [],
        count: (settings.whitelistedDomains || []).length
      };
    } catch (error) {
      Logger.error('Get whitelisted domains error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'DATA_ERROR',
          message: 'Failed to retrieve whitelisted domains',
          details: error.message,
          recoverable: false
        }
      };
    }
  });

  /**
   * Handle get blocked domains request
   */
  ipcMain.handle('policy:getBlockedDomains', async (event) => {
    try {
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to view policies',
            recoverable: true
          }
        };
      }
      
      const settings = await dataStore.getSettings();
      
      // If website blocking is enabled, all websites are blocked (represented as "*")
      // Return a descriptive list for the UI
      if (settings.websiteBlockEnabled) {
        return {
          success: true,
          domains: ['*'],
          description: 'All websites are blocked',
          count: 1
        };
      }
      
      // If no blocking is enabled, return empty list
      return {
        success: true,
        domains: [],
        description: 'No websites are blocked',
        count: 0
      };
    } catch (error) {
      Logger.error('Get blocked domains error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'DATA_ERROR',
          message: 'Failed to retrieve blocked domains',
          details: error.message,
          recoverable: false
        }
      };
    }
  });
  
  // ===== Settings Handlers =====
  
  /**
   * Handle get status request
   */
  ipcMain.handle('settings:getStatus', async (event) => {
    try {
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to view status',
            recoverable: true
          }
        };
      }
      
      // Get current policy status from PolicyManager
      const policyStatus = await policyManager.getCurrentPolicyStatus();
      
      // Get settings from data store
      const settings = await dataStore.getSettings();
      
      // Get toggle states from data store
      const toggleStates = await dataStore.getToggleStates();
      
      return {
        success: true,
        status: {
          authenticated: authManager.isAuthenticated(),
          user: authManager.getCurrentUser(),
          policies: policyStatus.success ? policyStatus.policies : null,
          settings: settings,
          toggleStates: toggleStates,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      Logger.error('Get status error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'STATUS_ERROR',
          message: 'Failed to retrieve status',
          details: error.message,
          recoverable: false
        }
      };
    }
  });
  
  /**
   * Handle update settings request
   */
  ipcMain.handle('settings:updateSettings', async (event, settings) => {
    try {
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to update settings',
            recoverable: true
          }
        };
      }
      
      await dataStore.updateSettings(settings);
      Logger.info('Settings updated successfully', settings, 'IPC');
      
      return {
        success: true,
        message: 'Settings updated successfully'
      };
    } catch (error) {
      Logger.error('Update settings error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'SETTINGS_ERROR',
          message: 'Failed to update settings',
          details: error.message,
          recoverable: false
        }
      };
    }
  });
  
  /**
   * Handle sync policy states request
   */
  ipcMain.handle('policy:syncPolicyStates', async (event) => {
    try {
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to sync policy states',
            recoverable: true
          }
        };
      }
      
      const result = await policyManager.syncPolicyStates();
      
      // Update toggle states in data store if sync was successful
      if (result.success) {
        await dataStore.updateToggleStates(result.states);
        Logger.info('Toggle states synchronized and saved', result.states, 'IPC');
      }
      
      return result;
    } catch (error) {
      Logger.error('Sync policy states error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'SYNC_ERROR',
          message: 'Failed to synchronize policy states',
          details: error.message,
          recoverable: false
        }
      };
    }
  });
  
  /**
   * Handle reset all policies request
   */
  ipcMain.handle('policy:resetAllPolicies', async (event) => {
    try {
      // Check if user is authenticated
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to reset policies',
            recoverable: true
          }
        };
      }
      
      const result = await policyManager.resetAllPolicies();
      
      // Update settings and toggle states in data store if reset was successful
      if (result.success) {
        await dataStore.updateSettings({
          driveBlockEnabled: false,
          websiteBlockEnabled: false,
          whitelistEnabled: false,
          whitelistedDomains: []
        });
        
        await dataStore.updateToggleStates({
          driveBlock: false,
          websiteBlock: false,
          whitelist: false,
          lastSynced: new Date().toISOString()
        });
        
        Logger.info('All policies reset and settings updated', null, 'IPC');
      }
      
      return result;
    } catch (error) {
      Logger.error('Reset all policies error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'RESET_ERROR',
          message: 'Failed to reset policies',
          details: error.message,
          recoverable: false
        }
      };
    }
  });
  
  // ===== Navigation Handlers =====
  
  /**
   * Handle load main app request (after successful login)
   */
  ipcMain.handle('navigation:loadMainApp', async (event) => {
    try {
      if (!authManager.isAuthenticated()) {
        return {
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Authentication required',
            details: 'You must be logged in to access the main application',
            recoverable: true
          }
        };
      }
      
      if (mainWindow) {
        mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
        Logger.info('Main application loaded', null, 'IPC');
      }
      
      return {
        success: true,
        message: 'Main application loaded'
      };
    } catch (error) {
      Logger.error('Load main app error', error, 'IPC');
      return {
        success: false,
        error: {
          code: 'NAVIGATION_ERROR',
          message: 'Failed to load main application',
          details: error.message,
          recoverable: false
        }
      };
    }
  });
  
  Logger.debug('IPC handlers registered successfully', null, 'Application');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });

  // Configure CSP headers for security
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data:; " +
          "font-src 'self'; " +
          "connect-src 'self'"
        ]
      }
    });
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'login.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    Logger.logAppEvent('startup', { 
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node
    });
    
    // Initialize services before creating window
    await initializeServices();
    
    // Register IPC handlers
    registerIpcHandlers();
    
    // Create window
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    Logger.error('Application initialization failed', error, 'Application');
    app.quit();
  }
});

app.on('window-all-closed', () => {
  Logger.logAppEvent('shutdown', { reason: 'All windows closed' });
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  Logger.logAppEvent('shutdown', { reason: 'Application quit requested' });
});
