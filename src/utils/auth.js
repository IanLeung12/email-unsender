/**
 * OAuth Authentication helper
 * Manages OAuth flows for Google and Microsoft
 */

const OAUTH_CONFIG = {
  google: {
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/gmail.modify'],
  },
  microsoft: {
    authEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['Mail.ReadWrite', 'Mail.Send'],
  },
};

/**
 * Initiate OAuth flow for a provider
 */
async function initiateOAuth(provider) {
  try {
    // TODO: Get extension ID dynamically
    const extensionId = chrome.runtime.id;
    const config = OAUTH_CONFIG[provider];
    
    if (!config) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    // Build authorization URL
    const clientId = getClientId(provider);
    const redirectUri = `https://${extensionId}.invalid/oauth-callback`;
    
    const authUrl = new URL(config.authEndpoint);
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', config.scopes.join(' '));
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');

    // Open OAuth window
    // TODO: Implement proper OAuth callback handling
    window.open(authUrl.toString(), 'oauth', 'width=500,height=600');

    return { success: true };
  } catch (error) {
    console.error('[Email Unsender] OAuth error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForToken(provider, code) {
  try {
    const config = OAUTH_CONFIG[provider];
    const clientId = getClientId(provider);
    const clientSecret = getClientSecret(provider);

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
        redirect_uri: `https://${chrome.runtime.id}.invalid/oauth-callback`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    const tokens = await response.json();
    return tokens;
  } catch (error) {
    console.error('[Email Unsender] Token exchange error:', error);
    throw error;
  }
}

/**
 * Refresh access token
 */
async function refreshAccessToken(provider, refreshToken) {
  try {
    const config = OAUTH_CONFIG[provider];
    const clientId = getClientId(provider);
    const clientSecret = getClientSecret(provider);

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
  const newTokens = await refreshAccessToken(provider, account.refreshToken);
  newTokens.expiresAt = Date.now() + (newTokens.expires_in * 1000);

  // Update stored account
  account.accessToken = newTokens.access_token;
  account.expiresAt = newTokens.expiresAt;

  return newTokens.access_token;
}

// Helper functions (to be implemented)
function getClientId(provider) {
  // TODO: Load from config/environment
  return 'TODO_CLIENT_ID';
}

function getClientSecret(provider) {
  // TODO: Load from config/environment (should be secure)
  return 'TODO_CLIENT_SECRET';
}

export { initiateOAuth, exchangeCodeForToken, refreshAccessToken, getValidAccessToken };
