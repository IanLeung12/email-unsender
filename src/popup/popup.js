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
  // Popup has window access, so it can initiate OAuth directly
  initiateOAuthFlow(provider);
}

async function initiateOAuthFlow(provider) {
  try {
    // Check if credentials are stored
    const clientId = localStorage.getItem(`${provider}_client_id`);
    const clientSecret = localStorage.getItem(`${provider}_client_secret`);
    
    if (!clientId || !clientSecret) {
      alert(`OAuth credentials not configured for ${provider}.\n\nPlease follow QUICK_SETUP.md to add credentials in the browser console.`);
      return;
    }

    // Use extension URL for redirect (works in both Firefox and Chrome)
    const redirectUri = chrome.runtime.getURL('pages/oauth-callback.html');

    // OAuth configuration
    const config = {
      google: {
        authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        scopes: ['https://www.googleapis.com/auth/gmail.modify'],
      },
      microsoft: {
        authEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        scopes: ['Mail.ReadWrite', 'Mail.Send', 'offline_access'],
      },
    };

    const providerConfig = config[provider];
    if (!providerConfig) {
      alert(`Unknown provider: ${provider}`);
      return;
    }

    // Build authorization URL
    const authUrl = new URL(providerConfig.authEndpoint);
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', providerConfig.scopes.join(' '));
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');

    console.log(`[Email Unsender] Opening OAuth window for ${provider}`);

    // Open OAuth window
    const authWindow = window.open(
      authUrl.toString(),
      'oauth_window',
      'width=500,height=600,menubar=no,toolbar=no,status=no'
    );

    if (!authWindow) {
      alert('Failed to open authorization window. Check popup blocker settings.');
      return;
    }

    // Wait for OAuth callback
    const code = await new Promise((resolve, reject) => {
      const handleMessage = (event) => {
        // Accept messages from our oauth-callback page
        if (event.data && event.data.type === 'oauth_code') {
          window.removeEventListener('message', handleMessage);
          if (authWindow && !authWindow.closed) {
            authWindow.close();
          }
          if (event.data.code) {
            resolve(event.data.code);
          } else {
            reject(new Error(event.data.error || 'OAuth cancelled'));
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Timeout after 5 minutes
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        if (authWindow && !authWindow.closed) {
          authWindow.close();
        }
        reject(new Error('OAuth authorization timed out'));
      }, 300000);
    });

    // Exchange code for tokens
    const tokens = await exchangeOAuthCode(provider, code, redirectUri);
    
    // Send tokens to background worker for storage
    chrome.runtime.sendMessage(
      { action: 'storeOAuthTokens', provider, tokens },
      (response) => {
        if (response && response.success) {
          checkAuthStatus();
        } else {
          alert(`Failed to store credentials: ${response?.error || 'Unknown error'}`);
        }
      }
    );
  } catch (error) {
    console.error('[Email Unsender] OAuth error:', error);
    alert(`Sign in failed: ${error.message}`);
  }
}

async function exchangeOAuthCode(provider, code, redirectUri) {
  const clientId = localStorage.getItem(`${provider}_client_id`);
  const clientSecret = localStorage.getItem(`${provider}_client_secret`);

  const tokenEndpoints = {
    google: 'https://oauth2.googleapis.com/token',
    microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  };

  const response = await fetch(tokenEndpoints[provider], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || response.statusText);
  }

  return await response.json();
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
