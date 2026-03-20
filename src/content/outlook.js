/**
 * Outlook Content Script
 * Injects unsend UI and detects send events
 */

console.log('[Email Unsender] Outlook content script loaded');

let emailSendContext = null;
let unsendTimer = null;

/**
 * Initialize content script
 */
function initializeOutlook() {
  // Monitor for send button clicks
  monitorSendButton();
  
  // Listen for messages from background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'unsendEmail') {
      performUnsend(sendResponse);
    }
  });
}

/**
 * Monitor for send button and intercept clicks
 */
function monitorSendButton() {
  // Outlook's send button typically has id="mail-send-button" or aria-label="Send"
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            findAndHookSendButton(node);
          }
        });
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also check existing buttons
  findAndHookSendButton(document.body);
}

/**
 * Recursively find send buttons and attach listeners
 */
function findAndHookSendButton(element) {
  if (!element) return;

  // Look for Outlook's send button
  const sendButtons = element.querySelectorAll(
    '[id*="mail-send-button"], [aria-label="Send"], [title="Send"]'
  );
  sendButtons.forEach((btn) => {
    if (!btn.classList.contains('eunsend-hooked')) {
      btn.classList.add('eunsend-hooked');
      btn.addEventListener('click', handleEmailSend, true);
    }
  });
}

/**
 * Handle send button click
 */
function handleEmailSend(event) {
  console.log('[Email Unsender] Email send intercepted on Outlook');
  
  // Get email data before sending
  emailSendContext = {
    provider: 'outlook',
    timestamp: Date.now(),
    recipients: extractRecipients(),
    subject: extractSubject(),
    emailId: null, // Will be populated after send
  };

  // Get settings for time window
  chrome.storage.local.get(['timeWindow'], (result) => {
    const timeWindow = result.timeWindow || 60;
    
    // Notify background that email was sent
    chrome.runtime.sendMessage({
      action: 'recordEmailSent',
      emailData: emailSendContext,
    });

    // Show unsend UI with countdown
    showUnsendUI(timeWindow);
  });
}

/**
 * Extract email recipients from compose area
 */
function extractRecipients() {
  try {
    // Look for recipient fields in Outlook compose window
    const recipientElements = document.querySelectorAll('[data-outlook-recipient]');
    const recipients = [];
    
    recipientElements.forEach((elem) => {
      const recipient = elem.textContent.trim();
      if (recipient) {
        recipients.push(recipient);
      }
    });

    return recipients.length > 0 ? recipients : ['Unknown'];
  } catch (err) {
    console.error('[Email Unsender] Error extracting recipients:', err);
    return ['Unknown'];
  }
}

/**
 * Extract email subject from compose area
 */
function extractSubject() {
  try {
    // Look for subject field in Outlook compose
    const subjectInput = document.querySelector('[aria-label*="Subject"]');
    if (subjectInput && subjectInput.value) {
      return subjectInput.value;
    }
    return '(no subject)';
  } catch (err) {
    console.error('[Email Unsender] Error extracting subject:', err);
    return '(no subject)';
  }
}

/**
 * Show unsend UI with countdown timer
 */
function showUnsendUI(timeWindow) {
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'eunsend-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: #323232;
    color: white;
    padding: 16px;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 10000;
    max-width: 300px;
  `;

  notification.innerHTML = `
    <div style="margin-bottom: 10px;">Email sent! Unsend in: <strong id="eunsend-timer">0:00</strong></div>
    <button id="eunsend-btn" style="
      padding: 8px 16px;
      background-color: #0078d4;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      margin-right: 8px;
    ">Unsend</button>
    <button id="eunsend-dismiss" style="
      padding: 8px 16px;
      background-color: transparent;
      color: white;
      border: 1px solid white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    ">Dismiss</button>
  `;

  document.body.appendChild(notification);

  const unsendBtn = notification.querySelector('#eunsend-btn');
  const dismissBtn = notification.querySelector('#eunsend-dismiss');
  const timerDisplay = notification.querySelector('#eunsend-timer');

  unsendBtn.addEventListener('click', () => {
    performUnsend(() => {
      notification.remove();
    });
  });

  dismissBtn.addEventListener('click', () => {
    notification.remove();
  });

  // Countdown timer
  let remainingTime = timeWindow;
  updateTimerDisplay(timerDisplay, remainingTime);

  unsendTimer = setInterval(() => {
    remainingTime--;
    updateTimerDisplay(timerDisplay, remainingTime);

    if (remainingTime <= 0) {
      clearInterval(unsendTimer);
      unsendBtn.disabled = true;
      unsendBtn.style.opacity = '0.5';
      unsendBtn.textContent = 'Time expired';
    }
  }, 1000);
}

/**
 * Update timer display
 */
function updateTimerDisplay(element, seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  element.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Perform unsend action
 */
function performUnsend(callback) {
  if (!emailSendContext) {
    if (callback) callback({ success: false, error: 'No email to unsend' });
    return;
  }

  console.log('[Email Unsender] Attempting to unsend email:', emailSendContext);

  // For now, this is a placeholder
  // TODO: Implement actual unsend via Microsoft Graph API in background worker
  chrome.runtime.sendMessage({
    action: 'unsendEmail',
    emailData: emailSendContext,
  }, (response) => {
    if (callback) callback(response);

    // Record unsend attempt
    chrome.runtime.sendMessage({
      action: 'recordUnsendAttempt',
      data: {
        ...emailSendContext,
        success: response.success,
        error: response.error,
      },
    });

    // Clear context
    emailSendContext = null;
    if (unsendTimer) clearInterval(unsendTimer);
  });
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeOutlook);
} else {
  initializeOutlook();
}
