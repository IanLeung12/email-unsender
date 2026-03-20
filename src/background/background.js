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
    case 'unsendEmail':
      handleUnsendEmail(sender.tab.id, sendResponse);
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

function handleUnsendEmail(tabId, sendResponse) {
  // TODO: Implement unsend logic
  sendResponse({ success: false, error: 'Unsend not yet implemented' });
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
  // TODO: Store email context for unsend window
  sendResponse({ success: true });
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
