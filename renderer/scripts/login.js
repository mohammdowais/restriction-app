// Login page logic
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('errorMessage');
const passwordRecoveryLink = document.getElementById('passwordRecoveryLink');

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Clear previous error messages
  errorMessage.textContent = '';
  errorMessage.classList.remove('show');
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  
  // Basic validation
  if (!username || !password) {
    showLoginError('Please enter both username and password');
    return;
  }
  
  try {
    // Call IPC authentication method
    const result = await window.api.login(username, password);
    
    if (result.success) {
      // Navigate to main app on successful login
      await window.api.loadMainApp();
    } else {
      // Display error message on authentication failure
      const message = result.error?.message || 'Authentication failed';
      showLoginError(message);
    }
  } catch (error) {
    showLoginError('An unexpected error occurred. Please try again.');
    console.error('Login error:', error);
  }
});

/**
 * Display login error message
 */
function showLoginError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('show');
}

// Handle password recovery link click
passwordRecoveryLink.addEventListener('click', (e) => {
  e.preventDefault();
  showPasswordRecoveryModal();
});


// Password Recovery Modal Logic
const modal = document.getElementById('passwordRecoveryModal');
const closeModalBtn = document.querySelector('.close-modal');
const methodSelection = document.getElementById('methodSelection');
const oldPasswordMethod = document.getElementById('oldPasswordMethod');
const securityQuestionMethod = document.getElementById('securityQuestionMethod');
const developerKeyMethod = document.getElementById('developerKeyMethod');
const recoverySuccess = document.getElementById('recoverySuccess');

// Recovery method buttons
const recoveryMethodBtns = document.querySelectorAll('.recovery-method-btn');
const backBtns = document.querySelectorAll('.back-btn');

// Forms
const oldPasswordForm = document.getElementById('oldPasswordForm');
const securityQuestionForm = document.getElementById('securityQuestionForm');
const developerKeyForm = document.getElementById('developerKeyForm');

// Error message elements
const oldPasswordError = document.getElementById('oldPasswordError');
const securityQuestionError = document.getElementById('securityQuestionError');
const developerKeyError = document.getElementById('developerKeyError');

// Show password recovery modal
function showPasswordRecoveryModal() {
  modal.classList.add('show');
  showMethodSelection();
}

// Hide password recovery modal
function hidePasswordRecoveryModal() {
  modal.classList.remove('show');
  resetModal();
}

// Show method selection screen
function showMethodSelection() {
  hideAllSections();
  methodSelection.classList.remove('hidden');
}

// Hide all sections
function hideAllSections() {
  methodSelection.classList.add('hidden');
  oldPasswordMethod.classList.add('hidden');
  securityQuestionMethod.classList.add('hidden');
  developerKeyMethod.classList.add('hidden');
  recoverySuccess.classList.add('hidden');
}

// Reset modal to initial state
function resetModal() {
  showMethodSelection();
  oldPasswordForm.reset();
  securityQuestionForm.reset();
  developerKeyForm.reset();
  oldPasswordError.textContent = '';
  securityQuestionError.textContent = '';
  developerKeyError.textContent = '';
}

// Validate password match
function validatePasswordMatch(password, confirmPassword, errorElement) {
  if (password !== confirmPassword) {
    errorElement.textContent = 'Passwords do not match';
    return false;
  }
  if (password.length < 4) {
    errorElement.textContent = 'Password must be at least 4 characters long';
    return false;
  }
  errorElement.textContent = '';
  return true;
}

// Close modal when clicking X
closeModalBtn.addEventListener('click', hidePasswordRecoveryModal);

// Close modal when clicking outside
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    hidePasswordRecoveryModal();
  }
});

// Handle recovery method selection
recoveryMethodBtns.forEach(btn => {
  btn.addEventListener('click', async (e) => {
    const method = e.target.dataset.method;
    hideAllSections();
    
    if (method === 'old') {
      oldPasswordMethod.classList.remove('hidden');
    } else if (method === 'security') {
      // Load security question
      try {
        const result = await window.api.getSecurityQuestion();
        if (result.success && result.question) {
          document.getElementById('securityQuestionLabel').textContent = result.question;
        } else {
          document.getElementById('securityQuestionLabel').textContent = 'Security Question (not set)';
        }
      } catch (error) {
        console.error('Error loading security question:', error);
      }
      securityQuestionMethod.classList.remove('hidden');
    } else if (method === 'developer') {
      developerKeyMethod.classList.remove('hidden');
    }
  });
});

// Handle back button clicks
backBtns.forEach(btn => {
  btn.addEventListener('click', showMethodSelection);
});

// Handle old password form submission
oldPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  oldPasswordError.textContent = '';
  oldPasswordError.classList.remove('show');
  
  const oldPassword = document.getElementById('oldPassword').value;
  const newPassword = document.getElementById('newPasswordOld').value;
  const confirmPassword = document.getElementById('confirmPasswordOld').value;
  
  // Validate password match
  if (!validatePasswordMatch(newPassword, confirmPassword, oldPasswordError)) {
    oldPasswordError.classList.add('show');
    return;
  }
  
  try {
    const result = await window.api.changePassword('old', {
      oldPassword,
      newPassword
    });
    
    if (result.success) {
      hideAllSections();
      recoverySuccess.classList.remove('hidden');
    } else {
      oldPasswordError.textContent = result.error?.message || 'Failed to change password';
      oldPasswordError.classList.add('show');
    }
  } catch (error) {
    oldPasswordError.textContent = 'An unexpected error occurred';
    oldPasswordError.classList.add('show');
    console.error('Password change error:', error);
  }
});

// Handle security question form submission
securityQuestionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  securityQuestionError.textContent = '';
  securityQuestionError.classList.remove('show');
  
  const answer = document.getElementById('securityAnswer').value;
  const newPassword = document.getElementById('newPasswordSecurity').value;
  const confirmPassword = document.getElementById('confirmPasswordSecurity').value;
  
  // Validate password match
  if (!validatePasswordMatch(newPassword, confirmPassword, securityQuestionError)) {
    securityQuestionError.classList.add('show');
    return;
  }
  
  try {
    const result = await window.api.changePassword('security', {
      answer,
      newPassword
    });
    
    if (result.success) {
      hideAllSections();
      recoverySuccess.classList.remove('hidden');
    } else {
      securityQuestionError.textContent = result.error?.message || 'Failed to change password';
      securityQuestionError.classList.add('show');
    }
  } catch (error) {
    securityQuestionError.textContent = 'An unexpected error occurred';
    securityQuestionError.classList.add('show');
    console.error('Password change error:', error);
  }
});

// Handle developer key form submission
developerKeyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  developerKeyError.textContent = '';
  developerKeyError.classList.remove('show');
  
  const key = document.getElementById('developerKey').value;
  const newPassword = document.getElementById('newPasswordDev').value;
  const confirmPassword = document.getElementById('confirmPasswordDev').value;
  
  // Validate password match
  if (!validatePasswordMatch(newPassword, confirmPassword, developerKeyError)) {
    developerKeyError.classList.add('show');
    return;
  }
  
  try {
    const result = await window.api.changePassword('developer', {
      key,
      newPassword
    });
    
    if (result.success) {
      hideAllSections();
      recoverySuccess.classList.remove('hidden');
    } else {
      developerKeyError.textContent = result.error?.message || 'Failed to change password';
      developerKeyError.classList.add('show');
    }
  } catch (error) {
    developerKeyError.textContent = 'An unexpected error occurred';
    developerKeyError.classList.add('show');
    console.error('Password change error:', error);
  }
});

// Handle close success button
document.getElementById('closeSuccessBtn').addEventListener('click', hidePasswordRecoveryModal);
