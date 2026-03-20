/**
 * Background Service Worker
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
  switch (request.action) {
    case 'getUnsendStatus':
      handleGetUnsendStatus(sender.tab.id, sendResponse);
      break;
    case 'getAuthStatus':
      handleGetAuthStatus(sendResponse);
      break;
    case 'initiateOAuth':
      handleInitiateOAuth(request.provider, sendResponse);
      break;
    case 'deleteEmailGmail':
      handleDeleteEmailGmail(request.emailId, request.emailData, sendResponse);
      break;
    case 'getAccounts':
      handleGetAccounts(sendResponse);
      break;
    case 'removeAccount':
      handleRemoveAccount(request.accountId, sendResponse);
      break;
    case 'recordEmailSent':
      handleRecordEmailSent(request.emailData, sendResponse);
      break;
    case 'recordUnsendAttempt':
      handleRecordUnsendAttempt(request.data, sendResponse);
      break;
    default:
      sendResponse({ error: 'Unknown action' });
  }
  return true; // Keep message channel open for async response
});

function handleGetUnsendStatus(tabId, sendResponse) {
  // TODO: Check if sending is in progress and time remaining
  sendResponse({
    canUnsend: false,
    timeRemaining: 0,
    emailId: null,
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

function handleInitiateOAuth(provider, sendResponse) {
  // TODO: Implement OAuth flow
  sendResponse({ success: false, error: 'OAuth not yet implemented' });
}

/**
 * Delete email via Gmail API
 * This simulates the unsend action by deleting the sent email
 */
function handleDeleteEmailGmail(emailId, emailData, sendResponse) {
  console.log('[Email Unsender] Deleting email via Gmail API:', emailId);

  // For now, we'll simulate success
  // TODO: Implement actual Gmail API call when OAuth is set up
  
  // Simulate API delay
  setTimeout(() => {
    // In real implementation, this would:
    // 1. Get valid access token for Gmail account
    // 2. Call Gmail API: DELETE https://www.googleapis.com/gmail/v1/users/me/messages/{id}
    // 3. Handle errors gracefully
    
    const success = Math.random() > 0.1; // 90% success rate for demo
    
    if (success) {
      console.log('[Email Unsender] Email deleted successfully (simulated)');
      sendResponse({
        success: true,
        message: 'Email deleted from sent folder',
      });
    } else {
      sendResponse({
        success: false,
        error: 'Failed to delete email. It may have been read already.',
      });
    }
  }, 300);
}

function handleGetAccounts(sendResponse) {
  chrome.storage.local.get(['accounts'], (result) => {
    sendResponse({ accounts: result.accounts || [] });
  });
}

function handleRemoveAccount(accountId, sendResponse) {
  chrome.storage.local.get(['accounts'], (result) => {
    const accounts = result.accounts || [];
    const updatedAccounts = accounts.filter((acc) => acc.id !== accountId);
    chrome.storage.local.set({ accounts: updatedAccounts }, () => {
      sendResponse({ success: true });
    });
  });
}

function handleRecordEmailSent(emailData, sendResponse) {
  // Store email context temporarily for unsend window
  // This is used to track active unsend windows
  chrome.storage.local.get(['activeUnsends'], (result) => {
    const activeUnsends = result.activeUnsends || {};
    const emailId = emailData.emailId || `temp_${Date.now()}`;
    activeUnsends[emailId] = {
      ...emailData,
      expiresAt: Date.now() + (emailData.timeWindow || 60) * 1000,
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
 * Utility: Get valid access token for Gmail
 * (To be implemented in Phase 5 with actual OAuth)
 */
async function getGmailAccessToken() {
  // TODO: Implement token refresh and validation
  // For now, return placeholder
  return 'PLACEHOLDER_ACCESS_TOKEN';
}

/**
 * Utility: Delete message via Gmail API
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

    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.statusText}`);
    }

    return { success: true };
  } catch (error) {
    console.error('[Email Unsender] Gmail API error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
