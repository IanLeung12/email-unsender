/**
 * Gmail Content Script
 * Injects unsend UI and detects send events
 * Stores email context for 1-5 min window to allow deletion
 */

console.log('[Email Unsender] Gmail content script loaded');

let emailSendContext = null;
let unsendTimer = null;
let activeUnsends = {}; // Track active unsend windows by email ID

/**
 * Initialize content script
 */
function initializeGmail() {
  // Monitor for send button clicks
  monitorSendButton();
  
  // Listen for messages from background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'unsendEmail') {
      performUnsend(request.emailId, sendResponse);
    }
  });
}

/**
 * Monitor for send button and intercept clicks
 */
function monitorSendButton() {
  // Use MutationObserver to catch dynamically added send buttons
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

  // Gmail's send button variations:
  // - [data-tooltip*="Send"]
  // - [aria-label*="Send"]
  // - role="button" with Send in aria-label
  const sendButtons = element.querySelectorAll(
    '[data-tooltip*="Send"], [aria-label*="Send"]'
  );
  
  sendButtons.forEach((btn) => {
    // Avoid hooking multiple times
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
  console.log('[Email Unsender] Email send intercepted on Gmail');
  
  // Extract email data from compose window
  const emailData = extractEmailData();
  
  emailSendContext = {
    provider: 'gmail',
    timestamp: Date.now(),
    recipients: emailData.recipients,
    subject: emailData.subject,
    emailId: null, // Will be set after email is sent
  };

  // Get settings for time window
  chrome.storage.local.get(['timeWindow'], (result) => {
    const timeWindow = result.timeWindow || 60;
    
    // Notify background that email was sent
    chrome.runtime.sendMessage({
      action: 'recordEmailSent',
      emailData: emailSendContext,
    });

    // Wait a bit for email to be sent, then show unsend UI
    // This gives Gmail time to process the send and generate an email ID
    setTimeout(() => {
      captureEmailIdAndShowUI(timeWindow);
    }, 500);
  });
}

/**
 * Extract email data from Gmail compose area
 */
function extractEmailData() {
  try {
    const recipients = [];
    const subject = extractSubject();

    // Try to extract To field
    const toInputs = document.querySelectorAll('[name="to"]');
    toInputs.forEach((input) => {
      if (input.value) {
        recipients.push(...input.value.split(',').map(e => e.trim()));
      }
    });

    // Fallback: look for aria-label="To" inputs
    if (recipients.length === 0) {
      const toFields = document.querySelectorAll('[aria-label*="To"]');
      toFields.forEach((field) => {
        const chips = field.querySelectorAll('[data-email]');
        chips.forEach((chip) => {
          const email = chip.getAttribute('data-email');
          if (email) recipients.push(email);
        });
      });
    }

    return {
      recipients: recipients.length > 0 ? recipients : ['Unknown'],
      subject: subject,
    };
  } catch (err) {
    console.error('[Email Unsender] Error extracting email data:', err);
    return {
      recipients: ['Unknown'],
      subject: '(no subject)',
    };
  }
}

/**
 * Extract email subject from compose area
 */
function extractSubject() {
  try {
    // Look for subject input with aria-label
    const subjectInputs = document.querySelectorAll('[aria-label*="Subject"]');
    for (let input of subjectInputs) {
      if (input.value) {
        return input.value;
      }
    }
    return '(no subject)';
  } catch (err) {
    console.error('[Email Unsender] Error extracting subject:', err);
    return '(no subject)';
  }
}

/**
 * Capture email ID after send and show unsend UI
 * Gmail creates a new message in the sent folder shortly after send
 */
function captureEmailIdAndShowUI(timeWindow) {
  // Try to find the recently sent email ID
  // This is done by looking at recent emails in the current view
  let emailId = extractRecentEmailId();

  if (!emailId) {
    console.warn('[Email Unsender] Could not extract email ID, using timestamp instead');
    emailId = `${emailSendContext.timestamp}`;
  }

  emailSendContext.emailId = emailId;
  activeUnsends[emailId] = emailSendContext;

  // Show unsend UI with countdown
  showUnsendUI(emailId, timeWindow);
}

/**
 * Try to extract the most recently sent email ID
 * Gmail stores email data in the DOM
 */
function extractRecentEmailId() {
  try {
    // Look for email data attributes in recently sent messages
    const emailElements = document.querySelectorAll('[data-message-id]');
    if (emailElements.length > 0) {
      // Get the last (most recent) email
      const lastEmail = emailElements[emailElements.length - 1];
      return lastEmail.getAttribute('data-message-id');
    }

    // Fallback: look in aria-labels
    const mailRows = document.querySelectorAll('[role="row"][data-thread-id]');
    if (mailRows.length > 0) {
      return mailRows[0].getAttribute('data-thread-id');
    }

    return null;
  } catch (err) {
    console.error('[Email Unsender] Error extracting email ID:', err);
    return null;
  }
}

/**
 * Show unsend UI with countdown timer
 */
function showUnsendUI(emailId, timeWindow) {
  // Create notification element
  const notification = document.createElement('div');
  notification.id = `eunsend-notification-${emailId}`;
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
    animation: slideIn 0.3s ease-out;
  `;

  notification.innerHTML = `
    <div style="margin-bottom: 10px;">Email sent! Unsend in: <strong id="eunsend-timer-${emailId}">0:00</strong></div>
    <button id="eunsend-btn-${emailId}" style="
      padding: 8px 16px;
      background-color: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      margin-right: 8px;
      transition: opacity 0.3s;
    ">Unsend</button>
    <button id="eunsend-dismiss-${emailId}" style="
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

  // Add slide-in animation CSS if not already there
  if (!document.querySelector('#eunsend-styles')) {
    const style = document.createElement('style');
    style.id = 'eunsend-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const unsendBtn = notification.querySelector(`#eunsend-btn-${emailId}`);
  const dismissBtn = notification.querySelector(`#eunsend-dismiss-${emailId}`);
  const timerDisplay = notification.querySelector(`#eunsend-timer-${emailId}`);

  unsendBtn.addEventListener('click', () => {
    performUnsend(emailId, (response) => {
      if (response.success) {
        notification.style.backgroundColor = '#4caf50';
        notification.innerHTML = `<strong>✓ Email unsent successfully!</strong>`;
        setTimeout(() => notification.remove(), 2000);
      } else {
        notification.style.backgroundColor = '#d32f2f';
        notification.innerHTML = `<strong>✗ Unsend failed</strong><br><small>${response.error || 'Unknown error'}</small>`;
      }
    });
  });

  dismissBtn.addEventListener('click', () => {
    notification.remove();
    if (unsendTimer) clearInterval(unsendTimer);
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
      unsendBtn.style.cursor = 'not-allowed';
      
      // Clean up stored context
      delete activeUnsends[emailId];
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
 * Perform unsend action via Gmail API
 */
function performUnsend(emailId, callback) {
  if (!activeUnsends[emailId]) {
    if (callback) callback({ success: false, error: 'Email context expired' });
    return;
  }

  console.log('[Email Unsender] Attempting to unsend email:', emailId);

  // Call background worker to delete via Gmail API
  chrome.runtime.sendMessage({
    action: 'deleteEmailGmail',
    emailId: emailId,
    emailData: activeUnsends[emailId],
  }, (response) => {
    if (callback) callback(response);

    // Record unsend attempt
    chrome.runtime.sendMessage({
      action: 'recordUnsendAttempt',
      data: {
        ...activeUnsends[emailId],
        success: response.success,
        error: response.error,
      },
    });

    // Clean up
    delete activeUnsends[emailId];
  });
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGmail);
} else {
  initializeGmail();
}
