/**
 * OAuth Authentication helper
 * Manages OAuth flows for Google and Microsoft
 */

// OAuth configuration
const OAUTH_CONFIG = {
  google: {
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/gmail.modify'],
    revokeEndpoint: 'https://oauth2.googleapis.com/revoke',
  },
  microsoft: {
    authEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['Mail.ReadWrite', 'Mail.Send', 'offline_access'],
    revokeEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
  },
};

/**
 * Start OAuth flow for a provider
 * Returns a promise that resolves when user completes OAuth
 */
async function startOAuthFlow(provider) {
  try {
    const config = OAUTH_CONFIG[provider];
    if (!config) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // Get extension ID
    const extensionId = chrome.runtime.id;
    const clientId = await getClientId(provider);
    
    if (!clientId) {
      throw new Error(`OAuth credentials not configured for ${provider}`);
    }

    const redirectUri = `https://${extensionId}.invalid/oauth-callback`;
    
    // Build authorization URL
    const authUrl = new URL(config.authEndpoint);
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', config.scopes.join(' '));
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');

    // Open OAuth window and wait for response
    const code = await new Promise((resolve, reject) => {
      const authWindow = window.open(
        authUrl.toString(),
        'oauth_window',
        'width=500,height=600'
      );

      // Listen for OAuth callback
      const handleMessage = (event) => {
        if (event.source === authWindow) {
          window.removeEventListener('message', handleMessage);
          if (event.data.type === 'oauth_code') {
            authWindow.close();
            if (event.data.code) {
              resolve(event.data.code);
            } else {
              reject(new Error(event.data.error || 'OAuth cancelled'));
            }
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Timeout if no response after 5 minutes
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        if (authWindow && !authWindow.closed) {
          authWindow.close();
        }
        reject(new Error('OAuth timeout'));
      }, 300000);
    });

    // Exchange code for tokens
    const tokens = await exchangeCodeForToken(provider, code);
    
    // Decode ID token to get user info
    const userInfo = decodeIdToken(tokens.id_token || '');
    
    // Store account with tokens
    const account = {
      id: `${provider}_${userInfo.sub || Date.now()}`,
      provider,
      email: userInfo.email || 'Unknown',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + ((tokens.expires_in || 3600) * 1000),
      idToken: tokens.id_token,
    };

    return account;
  } catch (error) {
    console.error('[Email Unsender] OAuth error:', error);
    throw error;
  }
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForToken(provider, code) {
  try {
    const config = OAUTH_CONFIG[provider];
    const clientId = await getClientId(provider);
    const clientSecret = await getClientSecret(provider);
    const extensionId = chrome.runtime.id;
    const redirectUri = `https://${extensionId}.invalid/oauth-callback`;

    const response = await fetch(config.tokenEndpoint, {
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
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error_description || response.statusText}`);
    }

    const tokens = await response.json();
    return tokens;
  } catch (error) {
    console.error('[Email Unsender] Token exchange error:', error);
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(provider, refreshToken) {
  try {
    const config = OAUTH_CONFIG[provider];
    const clientId = await getClientId(provider);
    const clientSecret = await getClientSecret(provider);

    const response = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const tokens = await response.json();
    return tokens;
  } catch (error) {
    console.error('[Email Unsender] Token refresh error:', error);
    throw error;
  }
}

/**
 * Get valid access token, refreshing if necessary
 */
async function getValidAccessToken(provider, account) {
  const now = Date.now();
  
  // Check if token is expired or expiring soon (within 5 minutes)
  if (account.expiresAt && account.expiresAt - now > 300000) {
    return account.accessToken;
  }

  // Need to refresh
  console.log('[Email Unsender] Refreshing access token for', provider);
  const newTokens = await refreshAccessToken(provider, account.refreshToken);
  const updatedAccount = {
    ...account,
    accessToken: newTokens.access_token,
    expiresAt: Date.now() + ((newTokens.expires_in || 3600) * 1000),
  };

  // Update stored account
  const accounts = await getStorageValue('accounts') || [];
  const idx = accounts.findIndex(a => a.id === account.id);
  if (idx >= 0) {
    accounts[idx] = updatedAccount;
    await setStorageValue('accounts', accounts);
  }

  return newTokens.access_token;
}

/**
 * Revoke OAuth tokens
 */
async function revokeTokens(provider, account) {
  try {
    const config = OAUTH_CONFIG[provider];
    const clientId = await getClientId(provider);
    const clientSecret = await getClientSecret(provider);

    const response = await fetch(config.revokeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token: account.refreshToken || account.accessToken,
      }),
    });

    if (!response.ok) {
      console.warn('[Email Unsender] Token revocation failed:', response.statusText);
    }

    return true;
  } catch (error) {
    console.error('[Email Unsender] Token revocation error:', error);
    // Continue even if revocation fails (token will expire naturally)
    return true;
  }
}

/**
 * Decode JWT token (basic, without verification)
 */
function decodeIdToken(token) {
  try {
    if (!token) return {};
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    
    const decoded = JSON.parse(atob(parts[1]));
    return decoded;
  } catch (error) {
    console.warn('[Email Unsender] Failed to decode ID token:', error);
    return {};
  }
}

/**
 * Storage helpers (use chrome.storage.local)
 */
async function getStorageValue(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key]);
    });
  });
}

async function setStorageValue(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve();
    });
  });
}

/**
 * Get OAuth credentials from environment/config
 * In production, these should be loaded from secure storage or environment variables
 */
async function getClientId(provider) {
  // TODO: Load from config or environment
  // For development, return placeholder
  const clientIds = {
    google: localStorage.getItem('google_client_id') || '',
    microsoft: localStorage.getItem('microsoft_client_id') || '',
  };
  return clientIds[provider] || '';
}

async function getClientSecret(provider) {
  // TODO: Load from config or environment
  // For development, return placeholder
  const clientSecrets = {
    google: localStorage.getItem('google_client_secret') || '',
    microsoft: localStorage.getItem('microsoft_client_secret') || '',
  };
  return clientSecrets[provider] || '';
}

export {
  startOAuthFlow,
  exchangeCodeForToken,
  refreshAccessToken,
  getValidAccessToken,
  revokeTokens,
  decodeIdToken,
  getStorageValue,
  setStorageValue,
};
