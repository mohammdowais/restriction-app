// Main application renderer logic

// DOM Elements
const driveBlockToggle = document.getElementById('driveBlockToggle');
const websiteBlockToggle = document.getElementById('websiteBlockToggle');
const whitelistToggle = document.getElementById('whitelistToggle');
const driveStatus = document.getElementById('driveStatus');
const websiteStatus = document.getElementById('websiteStatus');
const whitelistStatus = document.getElementById('whitelistStatus');
const domainInput = document.getElementById('domainInput');
const addDomainBtn = document.getElementById('addDomainBtn');
const domainList = document.getElementById('domainList');
const logoutBtn = document.getElementById('logoutBtn');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const messageArea = document.getElementById('messageArea');
const resetAllBtn = document.getElementById('resetAllBtn');
const resetModal = document.getElementById('resetModal');
const closeResetModal = document.getElementById('closeResetModal');
const cancelResetBtn = document.getElementById('cancelResetBtn');
const confirmResetBtn = document.getElementById('confirmResetBtn');

// Initialize application on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentStatus();
  setupEventListeners();
});

/**
 * Load and display current policy status on page load
 * Requirements: 1.4, 2.4, 8.1, 8.2, 8.3, 8.4, 8.5
 */
async function loadCurrentStatus() {
  try {
    // First, synchronize policy states with actual Group Policy settings
    const syncResult = await window.api.syncPolicyStates();
    
    if (syncResult.success) {
      const syncedStates = syncResult.states;
      
      // Update toggles to match synchronized state
      driveBlockToggle.checked = syncedStates.driveBlock || false;
      updateStatusIndicator(driveStatus, syncedStates.driveBlock);
      
      websiteBlockToggle.checked = syncedStates.websiteBlock || false;
      updateStatusIndicator(websiteStatus, syncedStates.websiteBlock);
      
      whitelistToggle.checked = syncedStates.whitelist || false;
      updateStatusIndicator(whitelistStatus, syncedStates.whitelist);
      
      console.log('Policy states synchronized:', syncedStates);
    } else {
      console.warn('Failed to sync policy states, loading from settings:', syncResult.error);
      
      // Fallback: Load from saved settings if sync fails
      const result = await window.api.getStatus();
      
      if (result.success) {
        const status = result.status;
        
        // Use toggle states if available, otherwise fall back to settings
        const toggleStates = status.toggleStates || {};
        
        driveBlockToggle.checked = toggleStates.driveBlock !== undefined 
          ? toggleStates.driveBlock 
          : (status.settings?.driveBlockEnabled || false);
        updateStatusIndicator(driveStatus, driveBlockToggle.checked);
        
        websiteBlockToggle.checked = toggleStates.websiteBlock !== undefined 
          ? toggleStates.websiteBlock 
          : (status.settings?.websiteBlockEnabled || false);
        updateStatusIndicator(websiteStatus, websiteBlockToggle.checked);
        
        whitelistToggle.checked = toggleStates.whitelist !== undefined 
          ? toggleStates.whitelist 
          : (status.settings?.whitelistEnabled || false);
        updateStatusIndicator(whitelistStatus, whitelistToggle.checked);
      } else {
        showErrorMessage(result.error, 'load status');
      }
    }
    
    // Load domain list
    await loadDomainList();
  } catch (error) {
    console.error('Error loading status:', error);
    showErrorMessage({ message: 'Error loading application status', details: error.message });
  }
}

/**
 * Setup all event listeners for UI interactions
 */
function setupEventListeners() {
  // Toggle switch event handlers (Subtask 11.1)
  driveBlockToggle.addEventListener('change', handleDriveBlockToggle);
  websiteBlockToggle.addEventListener('change', handleWebsiteBlockToggle);
  whitelistToggle.addEventListener('change', handleWhitelistToggle);
  
  // Domain management event handlers (Subtask 11.2)
  addDomainBtn.addEventListener('click', handleAddDomain);
  domainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleAddDomain();
    }
  });
  
  // Settings and logout event handlers (Subtask 11.3)
  logoutBtn.addEventListener('click', handleLogout);
  changePasswordBtn.addEventListener('click', handleChangePassword);
  
  // Reset modal event handlers (Task 10.4)
  resetAllBtn.addEventListener('click', showResetModal);
  closeResetModal.addEventListener('click', hideResetModal);
  cancelResetBtn.addEventListener('click', hideResetModal);
  confirmResetBtn.addEventListener('click', handleResetAllPolicies);
  
  // Close modal when clicking outside of it
  resetModal.addEventListener('click', (e) => {
    if (e.target === resetModal) {
      hideResetModal();
    }
  });
}

// ============================================================================
// Subtask 11.1: Toggle switch change handlers
// Requirements: 1.2, 1.3, 2.2, 2.3, 3.4, 3.5, 6.3
// ============================================================================

/**
 * Handle drive block toggle change
 * Requirements: 1.2, 1.3, 1.4, 1.5
 */
async function handleDriveBlockToggle(event) {
  const enabled = event.target.checked;
  
  try {
    const result = await window.api.toggleDriveBlock(enabled);
    
    if (result.success) {
      updateStatusIndicator(driveStatus, enabled);
      showSuccessMessage(
        enabled ? 'External drive write access blocked successfully' : 'External drive write access restored',
        enabled ? 'Users will not be able to write to external drives.' : 'Users can now write to external drives.'
      );
    } else {
      // Revert toggle on failure
      event.target.checked = !enabled;
      showErrorMessage(result.error, 'drive policy');
    }
  } catch (error) {
    // Revert toggle on error
    event.target.checked = !enabled;
    console.error('Error toggling drive block:', error);
    showErrorMessage({ message: 'Error updating drive policy', details: error.message });
  }
}

/**
 * Handle website block toggle change
 * Requirements: 2.2, 2.3, 2.4, 2.5
 */
async function handleWebsiteBlockToggle(event) {
  const enabled = event.target.checked;
  
  try {
    const result = await window.api.toggleWebsiteBlock(enabled);
    
    if (result.success) {
      updateStatusIndicator(websiteStatus, enabled);
      showSuccessMessage(
        enabled ? 'All websites blocked successfully' : 'Website blocking disabled',
        enabled ? 'All browsers will be blocked from accessing websites.' : 'Users can now access websites normally.'
      );
    } else {
      // Revert toggle on failure
      event.target.checked = !enabled;
      showErrorMessage(result.error, 'website policy');
    }
  } catch (error) {
    // Revert toggle on error
    event.target.checked = !enabled;
    console.error('Error toggling website block:', error);
    showErrorMessage({ message: 'Error updating website policy', details: error.message });
  }
}

/**
 * Handle whitelist toggle change
 * Requirements: 3.4, 3.5, 3.6
 */
async function handleWhitelistToggle(event) {
  const enabled = event.target.checked;
  
  try {
    const result = await window.api.toggleWhitelist(enabled);
    
    if (result.success) {
      updateStatusIndicator(whitelistStatus, enabled);
      showSuccessMessage(
        enabled ? 'Domain whitelist enabled successfully' : 'Domain whitelist disabled',
        enabled ? 'Only whitelisted domains will be accessible.' : 'All websites are now accessible (unless blocked).'
      );
    } else {
      // Revert toggle on failure
      event.target.checked = !enabled;
      showErrorMessage(result.error, 'whitelist policy');
    }
  } catch (error) {
    // Revert toggle on error
    event.target.checked = !enabled;
    console.error('Error toggling whitelist:', error);
    showErrorMessage({ message: 'Error updating whitelist policy', details: error.message });
  }
}

/**
 * Update status indicator text and styling
 * Requirements: 6.3
 */
function updateStatusIndicator(element, enabled) {
  if (enabled) {
    element.textContent = 'Enabled';
    element.classList.add('status-enabled');
    element.classList.remove('status-disabled');
  } else {
    element.textContent = 'Disabled';
    element.classList.add('status-disabled');
    element.classList.remove('status-enabled');
  }
}

// ============================================================================
// Subtask 11.2: Domain management logic
// Requirements: 3.2, 3.3, 3.6
// ============================================================================

/**
 * Handle add domain button click
 * Requirements: 3.2, 3.6
 */
async function handleAddDomain() {
  const domain = domainInput.value.trim();
  
  // Validate domain is not empty
  if (!domain) {
    showErrorMessage({ 
      message: 'Please enter a domain',
      code: 'INVALID_DOMAIN',
      details: 'Domain field cannot be empty'
    });
    return;
  }
  
  // Basic domain validation (client-side)
  if (!isValidDomain(domain)) {
    showErrorMessage({ 
      message: 'Invalid domain format',
      code: 'INVALID_DOMAIN'
    });
    return;
  }
  
  try {
    const result = await window.api.addDomain(domain);
    
    if (result.success) {
      domainInput.value = ''; // Clear input
      await loadDomainList(); // Refresh domain list
      showSuccessMessage(
        `Domain "${domain}" added successfully`,
        'The domain has been added to the whitelist and will be accessible when whitelist mode is enabled.'
      );
    } else {
      showErrorMessage(result.error, 'add domain');
    }
  } catch (error) {
    console.error('Error adding domain:', error);
    showErrorMessage({ message: 'Error adding domain', details: error.message });
  }
}

/**
 * Handle remove domain button click
 * Requirements: 3.3
 */
async function handleRemoveDomain(domain) {
  try {
    const result = await window.api.removeDomain(domain);
    
    if (result.success) {
      await loadDomainList(); // Refresh domain list
      showSuccessMessage(
        `Domain "${domain}" removed successfully`,
        'The domain has been removed from the whitelist and will no longer be accessible in whitelist mode.'
      );
    } else {
      showErrorMessage(result.error, 'remove domain');
    }
  } catch (error) {
    console.error('Error removing domain:', error);
    showErrorMessage({ message: 'Error removing domain', details: error.message });
  }
}

/**
 * Load and display domain list
 * Requirements: 3.2, 3.3
 */
async function loadDomainList() {
  try {
    const result = await window.api.getDomains();
    
    if (result.success) {
      const domains = result.domains || [];
      displayDomainList(domains);
    } else {
      console.error('Failed to load domains:', result.error);
    }
  } catch (error) {
    console.error('Error loading domains:', error);
  }
}

/**
 * Display domain list in UI
 * Requirements: 3.2, 3.3
 */
function displayDomainList(domains) {
  domainList.innerHTML = '';
  
  if (domains.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'domain-item empty';
    emptyItem.textContent = 'No domains added';
    domainList.appendChild(emptyItem);
    return;
  }
  
  domains.forEach(domain => {
    const listItem = document.createElement('li');
    listItem.className = 'domain-item';
    
    const domainText = document.createElement('span');
    domainText.className = 'domain-text';
    domainText.textContent = domain;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-danger btn-small';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => handleRemoveDomain(domain));
    
    listItem.appendChild(domainText);
    listItem.appendChild(removeBtn);
    domainList.appendChild(listItem);
  });
}

/**
 * Validate domain format (client-side validation)
 * Requirements: 3.6
 */
function isValidDomain(domain) {
  // Basic domain validation regex
  // Allows: example.com, sub.example.com, example.co.uk
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
}

// ============================================================================
// Subtask 11.3: Settings and logout functionality
// Requirements: 4.5, 5.1
// ============================================================================

/**
 * Handle logout button click
 * Requirements: 4.5
 */
async function handleLogout() {
  try {
    const result = await window.api.logout();
    
    if (result.success) {
      // Redirect to login page
      window.location.href = 'login.html';
    } else {
      showErrorMessage(result.error, 'logout');
    }
  } catch (error) {
    console.error('Error during logout:', error);
    showErrorMessage({ message: 'Error during logout', details: error.message });
  }
}

/**
 * Handle change password button click
 * Requirements: 5.1
 */
function handleChangePassword() {
  // Redirect to login page with password recovery modal
  // The password recovery functionality is already implemented in login.js
  window.location.href = 'login.html?showPasswordRecovery=true';
}

// ============================================================================
// Task 10.4: Reset Confirmation Modal
// Requirements: 9.1, 9.2
// ============================================================================

/**
 * Show the reset confirmation modal
 * Requirements: 9.1
 */
function showResetModal() {
  resetModal.classList.add('show');
  // Prevent body scroll when modal is open
  document.body.style.overflow = 'hidden';
}

/**
 * Hide the reset confirmation modal
 * Requirements: 9.1
 */
function hideResetModal() {
  resetModal.classList.remove('show');
  // Restore body scroll
  document.body.style.overflow = '';
}

/**
 * Handle reset all policies confirmation
 * Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8
 */
async function handleResetAllPolicies() {
  // Hide the modal first
  hideResetModal();
  
  try {
    // Show loading state
    confirmResetBtn.disabled = true;
    confirmResetBtn.textContent = 'Resetting...';
    
    const result = await window.api.resetAllPolicies();
    
    if (result.success) {
      // Update all toggles to disabled state (Requirement 9.6)
      driveBlockToggle.checked = false;
      websiteBlockToggle.checked = false;
      whitelistToggle.checked = false;
      
      // Update status indicators (Requirement 9.6)
      updateStatusIndicator(driveStatus, false);
      updateStatusIndicator(websiteStatus, false);
      updateStatusIndicator(whitelistStatus, false);
      
      // Clear domain list (Requirement 9.5)
      await loadDomainList();
      
      // Show success message (Requirement 9.8)
      showSuccessMessage(
        'All policies have been reset successfully',
        'All group policies have been disabled and settings restored to default state.'
      );
    } else {
      showErrorMessage(result.error, 'reset policies');
    }
  } catch (error) {
    console.error('Error resetting policies:', error);
    showErrorMessage({ message: 'Error resetting policies', details: error.message });
  } finally {
    // Restore button state
    confirmResetBtn.disabled = false;
    confirmResetBtn.textContent = 'Reset All';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Display message to user with enhanced error handling
 * Requirements: 1.5, 2.5, 7.3
 */
function showMessage(message, type = 'info', options = {}) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message message-${type}`;
  
  // Create message content container
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  
  // Add icon based on message type
  const icon = document.createElement('span');
  icon.className = 'message-icon';
  icon.innerHTML = getMessageIcon(type);
  messageContent.appendChild(icon);
  
  // Add message text
  const messageText = document.createElement('span');
  messageText.className = 'message-text';
  messageText.textContent = message;
  messageContent.appendChild(messageText);
  
  messageDiv.appendChild(messageContent);
  
  // Add additional instructions if provided
  if (options.instructions) {
    const instructionsDiv = document.createElement('div');
    instructionsDiv.className = 'message-instructions';
    instructionsDiv.textContent = options.instructions;
    messageDiv.appendChild(instructionsDiv);
  }
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'message-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Close message');
  closeBtn.addEventListener('click', () => {
    dismissMessage(messageDiv);
  });
  messageDiv.appendChild(closeBtn);
  
  messageArea.appendChild(messageDiv);
  
  // Auto-hide message after duration (longer for errors)
  const duration = type === 'error' ? 8000 : 5000;
  setTimeout(() => {
    dismissMessage(messageDiv);
  }, duration);
}

/**
 * Get icon HTML for message type
 */
function getMessageIcon(type) {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'warning':
      return '⚠';
    case 'info':
    default:
      return 'ℹ';
  }
}

/**
 * Dismiss a message with animation
 */
function dismissMessage(messageDiv) {
  if (messageDiv && messageDiv.parentNode === messageArea) {
    messageDiv.classList.add('fade-out');
    setTimeout(() => {
      if (messageDiv.parentNode === messageArea) {
        messageArea.removeChild(messageDiv);
      }
    }, 300);
  }
}

/**
 * Display success message with additional details
 * Requirements: 5.8, 1.4, 2.4
 */
function showSuccessMessage(message, details = null) {
  const options = details ? { instructions: details } : {};
  showMessage(message, 'success', options);
}

/**
 * Display user-friendly error message based on error object
 * Requirements: 1.5, 2.5, 7.3
 */
function showErrorMessage(error, context = '') {
  if (!error) {
    showMessage('An unknown error occurred', 'error');
    return;
  }
  
  let message = error.message || 'An error occurred';
  let instructions = null;
  
  // Handle specific error codes with user-friendly messages
  switch (error.code) {
    case 'INSUFFICIENT_PRIVILEGES':
    case 'PRIVILEGE_ERROR':
      message = 'Administrator privileges required';
      instructions = 'Please restart the application as administrator to modify Group Policy settings. Right-click the application and select "Run as administrator".';
      showMessage(message, 'error', { instructions });
      return;
      
    case 'REGISTRY_ACCESS_DENIED':
      message = 'Registry access denied';
      instructions = 'Unable to modify Windows registry. Please ensure the application is running with administrator privileges.';
      showMessage(message, 'error', { instructions });
      return;
      
    case 'POLICY_APPLICATION_FAILED':
      message = 'Failed to apply policy';
      instructions = 'The policy could not be applied. Please check that you have administrator privileges and try again.';
      showMessage(message, 'error', { instructions });
      return;
      
    case 'INVALID_DOMAIN':
      message = 'Invalid domain format';
      instructions = 'Please enter a valid domain name (e.g., example.com, subdomain.example.com).';
      showMessage(message, 'error', { instructions });
      return;
      
    case 'DOMAIN_ALREADY_EXISTS':
      message = 'Domain already exists';
      instructions = 'This domain is already in the whitelist.';
      showMessage(message, 'error', { instructions });
      return;
      
    case 'NOT_AUTHENTICATED':
      message = 'Authentication required';
      instructions = 'Your session has expired. Please log in again.';
      showMessage(message, 'error', { instructions });
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);
      return;
      
    case 'POWERSHELL_EXECUTION_FAILED':
      message = 'PowerShell execution failed';
      instructions = 'Unable to execute PowerShell commands. Please ensure PowerShell is available and the application has necessary permissions.';
      showMessage(message, 'error', { instructions });
      return;
      
    case 'DATA_ERROR':
    case 'SETTINGS_ERROR':
      message = 'Failed to save settings';
      instructions = 'Unable to save application settings. Please check file permissions and try again.';
      showMessage(message, 'error', { instructions });
      return;
      
    default:
      // Use the error message as-is for other errors
      if (error.details) {
        instructions = error.details;
      }
      showMessage(message, 'error', { instructions });
  }
}
