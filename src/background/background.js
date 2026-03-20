/**
 * Background Service Worker (Firefox)
 * Manages OAuth tokens, API calls, storage, and message passing
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Initialize default settings
    chrome.storage.local.set({
      timeWindow: 60,
      notifySuccess: true,
      notifyFailure: true,
      unsendHistory: [],
      accounts: [],
    });
  }
});

/**
 * Message handler for content scripts, popup, and options page
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle async messages
  switch (request.action) {
    case 'getUnsendStatus':
      handleGetUnsendStatus(sender.tab.id, sendResponse);
      return true;
    case 'getAuthStatus':
      handleGetAuthStatus(sendResponse);
      return true;
    case 'storeOAuthTokens':
      handleStoreOAuthTokens(request.provider, request.tokens, sendResponse);
      return true;
    case 'deleteEmailGmail':
      handleDeleteEmailGmail(request.emailId, request.emailData, sendResponse);
      return true;
    case 'deleteEmailOutlook':
      handleDeleteEmailOutlook(request.emailId, request.emailData, sendResponse);
      return true;
    case 'getAccounts':
      handleGetAccounts(sendResponse);
      return true;
    case 'removeAccount':
      handleRemoveAccount(request.accountId, sendResponse);
      return true;
    case 'recordEmailSent':
      handleRecordEmailSent(request.emailData, sendResponse);
      return true;
    case 'recordUnsendAttempt':
      handleRecordUnsendAttempt(request.data, sendResponse);
      return true;
    default:
      sendResponse({ error: 'Unknown action' });
  }
  return true;
});

function handleGetUnsendStatus(tabId, sendResponse) {
  chrome.storage.local.get(['activeUnsends'], (result) => {
    const activeUnsends = result.activeUnsends || {};
    // Get first active unsend
    const unsendId = Object.keys(activeUnsends)[0];
    if (unsendId) {
      const unsend = activeUnsends[unsendId];
      const now = Date.now();
      const timeRemaining = Math.max(0, Math.floor((unsend.expiresAt - now) / 1000));
      sendResponse({
        canUnsend: timeRemaining > 0,
        timeRemaining,
        emailId: unsendId,
      });
    } else {
      sendResponse({
        canUnsend: false,
        timeRemaining: 0,
        emailId: null,
      });
    }
  });
}

function handleGetAuthStatus(sendResponse) {
  chrome.storage.local.get(['accounts'], (result) => {
    const accounts = result.accounts || [];
    if (accounts.length > 0) {
      sendResponse({
        isAuthenticated: true,
        email: accounts[0].email,
        provider: accounts[0].provider,
      });
    } else {
      sendResponse({ isAuthenticated: false });
    }
  });
}

/**
 * Store OAuth tokens received from popup
 */
function handleStoreOAuthTokens(provider, tokens, sendResponse) {
  try {
    // Decode ID token to extract user info
    const userInfo = decodeJwt(tokens.id_token || '');
    
    // Create account object
    const account = {
      id: `${provider}_${userInfo.sub || Date.now()}`,
      provider,
      email: userInfo.email || 'Unknown',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + ((tokens.expires_in || 3600) * 1000),
    };

    // Get existing accounts and add new one
    chrome.storage.local.get(['accounts'], (result) => {
      const accounts = result.accounts || [];
      // Remove existing account for this provider to avoid duplicates
      const filtered = accounts.filter(a => a.provider !== provider);
      filtered.push(account);
      
      chrome.storage.local.set({ accounts: filtered }, () => {
        console.log(`[Email Unsender] Account added: ${account.email}`);
        sendResponse({
          success: true,
          email: account.email,
          provider,
        });
      });
    });
  } catch (error) {
    console.error('[Email Unsender] Error storing tokens:', error);
    sendResponse({
      success: false,
      error: error.message || 'Failed to store tokens',
    });
  }
}

/**
 * Delete email via Gmail API
 */
function handleDeleteEmailGmail(emailId, emailData, sendResponse) {
  console.log('[Email Unsender] Deleting email via Gmail API:', emailId);

  // Get Gmail account
  chrome.storage.local.get(['accounts'], async (result) => {
    const accounts = result.accounts || [];
    const gmailAccount = accounts.find(a => a.provider === 'google');

    if (!gmailAccount) {
      sendResponse({
        success: false,
        error: 'No Google account signed in. Please sign in first.',
      });
      return;
    }

    try {
      // Get valid access token
      let accessToken = gmailAccount.accessToken;
      
      // Check if token needs refresh
      const now = Date.now();
      if (gmailAccount.expiresAt - now < 300000) { // Expire within 5 min
        console.log('[Email Unsender] Refreshing Gmail token');
        const newTokens = await refreshGmailToken(gmailAccount.refreshToken);
        accessToken = newTokens.access_token;
        
        // Update account in storage
        gmailAccount.accessToken = accessToken;
        gmailAccount.expiresAt = Date.now() + (newTokens.expires_in * 1000);
        accounts[accounts.indexOf(gmailAccount)] = gmailAccount;
        chrome.storage.local.set({ accounts });
      }

      // Call Gmail API to delete message
      const result = await deleteGmailMessage(accessToken, emailId);
      sendResponse(result);
    } catch (error) {
      console.error('[Email Unsender] Error deleting email:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to delete email',
      });
    }
  });
}

/**
 * Delete email via Microsoft Graph API (Outlook/Office 365)
 */
function handleDeleteEmailOutlook(emailId, emailData, sendResponse) {
  console.log('[Email Unsender] Deleting email via Microsoft Graph API:', emailId);

  // Get Outlook/Microsoft account
  chrome.storage.local.get(['accounts'], async (result) => {
    const accounts = result.accounts || [];
    const outlookAccount = accounts.find(a => a.provider === 'microsoft');

    if (!outlookAccount) {
      sendResponse({
        success: false,
        error: 'No Microsoft account signed in. Please sign in first.',
      });
      return;
    }

    try {
      // Get valid access token
      let accessToken = outlookAccount.accessToken;
      
      // Check if token needs refresh
      const now = Date.now();
      if (outlookAccount.expiresAt - now < 300000) { // Expire within 5 min
        console.log('[Email Unsender] Refreshing Microsoft token');
        const newTokens = await refreshMicrosoftToken(outlookAccount.refreshToken);
        accessToken = newTokens.access_token;
        
        // Update account in storage
        outlookAccount.accessToken = accessToken;
        outlookAccount.expiresAt = Date.now() + (newTokens.expires_in * 1000);
        accounts[accounts.indexOf(outlookAccount)] = outlookAccount;
        chrome.storage.local.set({ accounts });
      }

      // Call Microsoft Graph API to delete message
      const result = await deleteOutlookMessage(accessToken, emailId);
      sendResponse(result);
    } catch (error) {
      console.error('[Email Unsender] Error deleting Outlook email:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to delete email',
      });
    }
  });
}


function handleGetAccounts(sendResponse) {
  chrome.storage.local.get(['accounts'], (result) => {
    const accounts = (result.accounts || [])
      .map(a => ({
        id: a.id,
        email: a.email,
        provider: a.provider,
      }));
    sendResponse({ accounts });
  });
}

function handleRemoveAccount(accountId, sendResponse) {
  chrome.storage.local.get(['accounts'], (result) => {
    const accounts = result.accounts || [];
    const updated = accounts.filter((acc) => acc.id !== accountId);
    chrome.storage.local.set({ accounts: updated }, () => {
      sendResponse({ success: true });
    });
  });
}

function handleRecordEmailSent(emailData, sendResponse) {
  chrome.storage.local.get(['activeUnsends', 'timeWindow'], (result) => {
    const activeUnsends = result.activeUnsends || {};
    const timeWindow = result.timeWindow || 60;
    const emailId = emailData.emailId || `temp_${Date.now()}`;
    
    activeUnsends[emailId] = {
      ...emailData,
      expiresAt: Date.now() + (timeWindow * 1000),
    };
    
    chrome.storage.local.set({ activeUnsends }, () => {
      sendResponse({ success: true });
    });
  });
}

function handleRecordUnsendAttempt(data, sendResponse) {
  chrome.storage.local.get(['unsendHistory'], (result) => {
    const history = result.unsendHistory || [];
    history.push({
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...data,
    });
    // Keep only last 200 items
    const trimmedHistory = history.slice(-200);
    chrome.storage.local.set({ unsendHistory: trimmedHistory }, () => {
      sendResponse({ success: true });
    });
  });
}

/**
 * Exchange authorization code for access/refresh tokens
 */
async function exchangeCodeForTokens(provider, code, clientId, clientSecret, redirectUri, tokenEndpoint) {
  const body = {
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  };

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error_description || 'Failed to exchange code for token');
  }

  return await response.json();
}

/**
 * Simple JWT decoder (for ID tokens only, does not verify signature)
 */
function decodeJwt(token) {
  if (!token) return {};
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    
    const decoded = atob(parts[1]);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('[Email Unsender] Failed to decode JWT:', error);
    return {};
  }
}

/**
 * Gmail API Helper: Refresh token
 */
async function refreshGmailToken(refreshToken) {
  const clientId = localStorage.getItem('google_client_id');
  const clientSecret = localStorage.getItem('google_client_secret');

  if (!clientId || !clientSecret) {
    throw new Error('OAuth credentials not configured in localStorage');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Gmail API Helper: Delete message
 */
async function deleteGmailMessage(accessToken, messageId) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 204) {
      // 204 No Content = success
      return {
        success: true,
        message: 'Email deleted successfully',
      };
    } else if (response.status === 404) {
      return {
        success: false,
        error: 'Email not found. It may have been deleted already.',
      };
    } else if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || `Gmail API error: ${response.statusText}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[Email Unsender] Gmail API error:', error);
    return {
      success: false,
      error: error.message || 'Network error deleting email',
    };
  }
}

/**
 * Microsoft Graph API Helper: Refresh token
 */
async function refreshMicrosoftToken(refreshToken) {
  const clientId = localStorage.getItem('microsoft_client_id');
  const clientSecret = localStorage.getItem('microsoft_client_secret');

  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth credentials not configured in localStorage');
  }

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Microsoft token refresh failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Microsoft Graph API Helper: Delete message
 */
async function deleteOutlookMessage(accessToken, messageId) {
  try {
    // Microsoft Graph uses /me/messages/{id} endpoint
    // For folder-specific deletion, use /me/mailfolders/{folderId}/messages/{id}
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 204) {
      // 204 No Content = success
      return {
        success: true,
        message: 'Email deleted successfully',
      };
    } else if (response.status === 404) {
      return {
        success: false,
        error: 'Email not found. It may have been deleted already.',
      };
    } else if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || `Microsoft Graph API error: ${response.statusText}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[Email Unsender] Microsoft Graph API error:', error);
    return {
      success: false,
      error: error.message || 'Network error deleting email',
    };
  }
}

