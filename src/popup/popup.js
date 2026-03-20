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

  if (unsendBtn) unsendBtn.addEventListener('click', handleUnsendClick);
  if (openOptionsBtn) openOptionsBtn.addEventListener('click', openOptions);
  if (googleSigninBtn) googleSigninBtn.addEventListener('click', () => handleSignIn('google'));
  if (outlookSigninBtn) outlookSigninBtn.addEventListener('click', () => handleSignIn('outlook'));

  // Check authentication status and update UI
  checkAuthStatus();
  
  // Request current email context from background
  chrome.runtime.sendMessage({ action: 'getUnsendStatus' }, (response) => {
    if (response) {
      updateTimerDisplay(response);
    }
  });
}

function checkAuthStatus() {
  chrome.runtime.sendMessage({ action: 'getAuthStatus' }, (response) => {
    const authSection = document.getElementById('auth-section');
    const accountInfo = document.getElementById('account-info');
    const accountEmail = document.getElementById('account-email');

    if (response && response.isAuthenticated) {
      if (authSection) authSection.style.display = 'none';
      if (accountInfo) accountInfo.style.display = 'block';
      if (accountEmail) accountEmail.textContent = response.email || 'Unknown';
    } else {
      if (authSection) authSection.style.display = 'block';
      if (accountInfo) accountInfo.style.display = 'none';
    }
  });
}

function handleUnsendClick() {
  const btn = document.getElementById('unsend-btn');
  if (!btn) return;
  
  btn.disabled = true;
  btn.textContent = 'Unsending...';

  chrome.runtime.sendMessage({ action: 'unsendEmail' }, (response) => {
    if (response && response.success) {
      btn.textContent = '✓ Unsent!';
      btn.style.backgroundColor = '#4caf50';
      setTimeout(() => window.close(), 1500);
    } else {
      btn.textContent = '✗ Failed';
      btn.style.backgroundColor = '#d32f2f';
      btn.disabled = false;
    }
  });
}

function openOptions() {
  chrome.runtime.openOptionsPage();
  window.close();
}

function handleSignIn(provider) {
  chrome.runtime.sendMessage({ action: 'initiateOAuth', provider }, (response) => {
    if (response && response.success) {
      checkAuthStatus();
    } else {
      alert(`Sign in failed: ${response?.error || 'Unknown error'}`);
    }
  });
}

function updateTimerDisplay(status) {
  const timerDisplay = document.getElementById('timer-display');
  const timerValue = document.getElementById('timer-value');

  if (timerDisplay && status && status.canUnsend && status.timeRemaining > 0) {
    timerDisplay.style.display = 'block';
    if (timerValue) timerValue.textContent = formatTime(status.timeRemaining);
  } else {
    if (timerDisplay) timerDisplay.style.display = 'none';
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
