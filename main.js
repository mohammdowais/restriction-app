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
    Logger.log('Initializing application services...');
    
    // Initialize data store and load data
    dataStore = new DataStore();
    await dataStore.load();
    
    // Initialize managers
    authManager = new AuthManager(dataStore);
    passwordManager = new PasswordManager(dataStore);
    policyManager = new PolicyManager();
    
    Logger.log('Application services initialized successfully');
    
    // Check for admin privileges on startup
    const privilegeCheck = await PrivilegeChecker.checkAdminPrivileges();
    if (!privilegeCheck.hasPrivileges) {
      Logger.warn('Application is not running with administrator privileges');
      Logger.warn('Some features may not work correctly');
      
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
      Logger.log('Application is running with administrator privileges');
    }
  } catch (error) {
    Logger.error('Failed to initialize application services', error);
    throw error;
  }
}

/**
 * Register all IPC handlers for communication with renderer process
 */
function registerIpcHandlers() {
  Logger.log('Registering IPC handlers...');
  
  // ===== Authentication Handlers =====
  
  /**
   * Handle login authentication request
   */
  ipcMain.handle('auth:login', async (event, username, password) => {
    try {
      Logger.log(`Login attempt for user: ${username}`);
      const result = await authManager.authenticate(username, password);
      
      if (result.success) {
        Logger.log(`Login successful for user: ${username}`);
      } else {
        Logger.log(`Login failed for user: ${username}`);
      }
      
      return result;
    } catch (error) {
      Logger.error('Login error', error);
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
      Logger.log('Logout request received');
      const result = await authManager.logout();
      
      if (result.success) {
        Logger.log('Logout successful');
      }
      
      return result;
    } catch (error) {
      Logger.error('Logout error', error);
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
      Logger.log(`Password change request using method: ${method}`);
      
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
        Logger.log(`Password changed successfully using method: ${method}`);
      } else {
        Logger.log(`Password change failed using method: ${method}`);
      }
      
      return result;
    } catch (error) {
      Logger.error('Password change error', error);
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
      Logger.log('Get security question request received');
      const question = await passwordManager.getSecurityQuestion();
      
      return {
        success: true,
        question: question
      };
    } catch (error) {
      Logger.error('Get security question error', error);
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
  
  // ===== Policy Handlers =====
  
  /**
   * Handle toggle drive block request
   */
  ipcMain.handle('policy:toggleDriveBlock', async (event, enabled) => {
    try {
      Logger.log(`Toggle drive block request: ${enabled}`);
      
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
      
      // Update settings in data store
      if (result.success) {
        await dataStore.updateSettings({
          driveBlockEnabled: enabled
        });
      }
      
      return result;
    } catch (error) {
      Logger.error('Toggle drive block error', error);
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
      Logger.log(`Toggle website block request: ${enabled}`);
      
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
      
      // Update settings in data store
      if (result.success) {
        await dataStore.updateSettings({
          websiteBlockEnabled: enabled
        });
      }
      
      return result;
    } catch (error) {
      Logger.error('Toggle website block error', error);
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
      Logger.log(`Toggle whitelist request: ${enabled}`);
      
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
      
      // Update settings in data store
      if (result.success) {
        await dataStore.updateSettings({
          whitelistEnabled: enabled
        });
      }
      
      return result;
    } catch (error) {
      Logger.error('Toggle whitelist error', error);
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
      Logger.log(`Add domain request: ${domain}`);
      
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
      Logger.error('Add domain error', error);
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
      Logger.log(`Remove domain request: ${domain}`);
      
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
      Logger.error('Remove domain error', error);
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
      Logger.log('Get domains request received');
      
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
      Logger.error('Get domains error', error);
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
  
  // ===== Settings Handlers =====
  
  /**
   * Handle get status request
   */
  ipcMain.handle('settings:getStatus', async (event) => {
    try {
      Logger.log('Get status request received');
      
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
      
      return {
        success: true,
        status: {
          authenticated: authManager.isAuthenticated(),
          user: authManager.getCurrentUser(),
          policies: policyStatus.success ? policyStatus.policies : null,
          settings: settings,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      Logger.error('Get status error', error);
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
      Logger.log('Update settings request received', settings);
      
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
      
      return {
        success: true,
        message: 'Settings updated successfully'
      };
    } catch (error) {
      Logger.error('Update settings error', error);
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
  
  // ===== Navigation Handlers =====
  
  /**
   * Handle load main app request (after successful login)
   */
  ipcMain.handle('navigation:loadMainApp', async (event) => {
    try {
      Logger.log('Load main app request received');
      
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
      }
      
      return {
        success: true,
        message: 'Main application loaded'
      };
    } catch (error) {
      Logger.error('Load main app error', error);
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
  
  Logger.log('IPC handlers registered successfully');
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
    Logger.error('Application initialization failed', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
