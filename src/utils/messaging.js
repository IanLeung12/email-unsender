/**
 * Message passing helpers
 * Simplifies message passing between components
 */

/**
 * Send message to content script in specific tab
 */
async function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send message to background service worker
 */
async function sendMessageToBackground(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send message to all tabs
 */
async function broadcastMessage(message) {
  const tabs = await chrome.tabs.query({});
  return Promise.all(tabs.map((tab) => sendMessageToTab(tab.id, message)));
}

export {
  sendMessageToTab,
  sendMessageToBackground,
  broadcastMessage,
};
