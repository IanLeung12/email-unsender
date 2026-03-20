/**
 * Popup script
 * Handles UI, timer display, and user interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  initializePopup();
});

function initializePopup() {
  const unsendBtn = document.getElementById('unsend-btn');
  const openOptionsBtn = document.getElementById('open-options');
  const googleSigninBtn = document.getElementById('google-signin');
  const outlookSigninBtn = document.getElementById('outlook-signin');

  unsendBtn.addEventListener('click', handleUnsendClick);
  openOptionsBtn.addEventListener('click', openOptions);
  googleSigninBtn.addEventListener('click', () => handleSignIn('google'));
  outlookSigninBtn.addEventListener('click', () => handleSignIn('outlook'));

  // Check authentication status and update UI
  checkAuthStatus();
  
  // Request current email context from background
  chrome.runtime.sendMessage({ action: 'getUnsendStatus' }, (response) => {
    updateTimerDisplay(response);
  });
}

function checkAuthStatus() {
  chrome.runtime.sendMessage({ action: 'getAuthStatus' }, (response) => {
    const authSection = document.getElementById('auth-section');
    const accountInfo = document.getElementById('account-info');
    const accountEmail = document.getElementById('account-email');

    if (response.isAuthenticated) {
      authSection.style.display = 'none';
      accountInfo.style.display = 'block';
      accountEmail.textContent = response.email || 'Unknown';
    } else {
      authSection.style.display = 'block';
      accountInfo.style.display = 'none';
    }
  });
}

function handleUnsendClick() {
  chrome.runtime.sendMessage({ action: 'unsendEmail' }, (response) => {
    if (response.success) {
      alert('Email unsent successfully!');
      window.close();
    } else {
      alert(`Failed to unsend: ${response.error}`);
    }
  });
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

function handleSignIn(provider) {
  chrome.runtime.sendMessage({ action: 'initiateOAuth', provider }, (response) => {
    if (response.success) {
      checkAuthStatus();
    } else {
      alert(`Sign in failed: ${response.error}`);
    }
  });
}

function updateTimerDisplay(status) {
  const timerDisplay = document.getElementById('timer-display');
  const timerValue = document.getElementById('timer-value');

  if (status.canUnsend && status.timeRemaining > 0) {
    timerDisplay.style.display = 'block';
    timerValue.textContent = formatTime(status.timeRemaining);
  } else {
    timerDisplay.style.display = 'none';
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
