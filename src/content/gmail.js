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
  
  // Monitor for sent folder view (Phase 3: Recall)
  monitorSentFolder();
  
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

/**
 * PHASE 3: RECALL - Monitor for sent folder view and inject unsend buttons
 */
function monitorSentFolder() {
  // Use MutationObserver to detect when emails are loaded in the list
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(() => {
      injectUnsendButtonsToSentEmails();
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial scan for existing emails
  injectUnsendButtonsToSentEmails();
}

/**
 * Check if we're in the sent folder and inject unsend buttons
 */
function injectUnsendButtonsToSentEmails() {
  // Check if we're in sent folder by looking for navigation indicators
  // Gmail has the folder name in the page header or sidebar
  const isSentFolder = checkIfSentFolder();
  
  if (!isSentFolder) return;

  // Find all email rows in the list
  const emailRows = document.querySelectorAll('[role="row"][data-thread-id]');
  
  emailRows.forEach((row) => {
    const threadId = row.getAttribute('data-thread-id');
    if (!threadId) return;

    // Check if we already added a button to this row
    if (row.classList.contains('eunsend-recall-processed')) {
      return;
    }

    row.classList.add('eunsend-recall-processed');

    // Extract email info from the row
    const emailInfo = extractEmailInfoFromRow(row);

    // Add hover-revealed unsend button
    addUnsendButtonToRow(row, threadId, emailInfo);
  });
}

/**
 * Determine if we're currently viewing the sent folder
 */
function checkIfSentFolder() {
  try {
    // Look for "Sent" in the sidebar or navigation
    const navItems = document.querySelectorAll('[role="navigation"] [role="tab"], [aria-label*="Sent"]');
    
    for (let item of navItems) {
      if (item.textContent.includes('Sent') || item.getAttribute('aria-label')?.includes('Sent')) {
        // Check if it's the active/selected item
        if (item.getAttribute('aria-selected') === 'true' || item.classList.contains('selected')) {
          return true;
        }
      }
    }

    // Fallback: check if "Sent" appears in the page title/header
    const headerText = document.querySelector('[role="heading"]')?.textContent || '';
    return headerText.includes('Sent');
  } catch (err) {
    console.error('[Email Unsender] Error checking for sent folder:', err);
    return false;
  }
}

/**
 * Extract email information from a row element
 */
function extractEmailInfoFromRow(row) {
  try {
    const threadId = row.getAttribute('data-thread-id');
    
    // Extract sender/from (usually the first column)
    const senderElement = row.querySelector('[data-sender-email], [role="gridcell"]');
    const sender = senderElement?.textContent?.trim() || 'Unknown';

    // Extract subject (usually second column)
    const subjectElement = row.querySelectorAll('[role="gridcell"]')[1];
    const subject = subjectElement?.textContent?.trim() || '(no subject)';

    // Extract recipient/to from the preview or subject area
    const recipients = extractRecipientsFromRow(row);

    return {
      threadId,
      sender,
      subject,
      recipients: recipients.length > 0 ? recipients : ['Unknown'],
    };
  } catch (err) {
    console.error('[Email Unsender] Error extracting email info:', err);
    return {
      threadId: '',
      sender: 'Unknown',
      subject: '(no subject)',
      recipients: ['Unknown'],
    };
  }
}

/**
 * Try to extract recipient addresses from row
 */
function extractRecipientsFromRow(row) {
  try {
    // Look for recipient info in data attributes or aria-labels
    const cells = row.querySelectorAll('[role="gridcell"]');
    const recipients = [];

    // Check each cell for email-like patterns
    cells.forEach((cell) => {
      const text = cell.textContent;
      // Simple email regex
      const emailMatches = text.match(/[\w.-]+@[\w.-]+\.\w+/g);
      if (emailMatches) {
        recipients.push(...emailMatches);
      }
    });

    // Remove duplicates
    return [...new Set(recipients)];
  } catch (err) {
    return [];
  }
}

/**
 * Add an unsend button to an email row (revealed on hover)
 */
function addUnsendButtonToRow(row, threadId, emailInfo) {
  try {
    // Create a container for the unsend button
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'eunsend-recall-button-container';
    buttonContainer.style.cssText = `
      display: none;
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 1000;
    `;

    // Create unsend button
    const unsendBtn = document.createElement('button');
    unsendBtn.className = 'eunsend-recall-button';
    unsendBtn.textContent = 'Unsend';
    unsendBtn.style.cssText = `
      padding: 6px 12px;
      background-color: #d32f2f;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: background-color 0.2s;
    `;

    unsendBtn.addEventListener('mouseover', () => {
      unsendBtn.style.backgroundColor = '#b71c1c';
    });

    unsendBtn.addEventListener('mouseout', () => {
      unsendBtn.style.backgroundColor = '#d32f2f';
    });

    unsendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleRecallUnsend(threadId, emailInfo, unsendBtn);
    });

    buttonContainer.appendChild(unsendBtn);

    // Make row position relative for absolute positioning
    if (getComputedStyle(row).position === 'static') {
      row.style.position = 'relative';
    }

    row.appendChild(buttonContainer);

    // Show button on hover
    row.addEventListener('mouseenter', () => {
      buttonContainer.style.display = 'block';
    });

    row.addEventListener('mouseleave', () => {
      buttonContainer.style.display = 'none';
    });

  } catch (err) {
    console.error('[Email Unsender] Error adding button to row:', err);
  }
}

/**
 * Handle unsend from sent folder (Phase 3: Recall)
 */
function handleRecallUnsend(threadId, emailInfo, button) {
  console.log('[Email Unsender] Unsending from sent folder:', threadId, emailInfo);

  // Disable button while processing
  button.disabled = true;
  button.textContent = 'Unsending...';
  button.style.backgroundColor = '#999';

  // Create unsend context for this email
  const unsendContext = {
    provider: 'gmail',
    type: 'recall', // Distinguish from quick undo
    timestamp: Date.now(),
    recipients: emailInfo.recipients,
    subject: emailInfo.subject,
    sender: emailInfo.sender,
    emailId: threadId,
  };

  // Store in activeUnsends for tracking
  activeUnsends[threadId] = unsendContext;

  // Call background worker to delete via Gmail API
  chrome.runtime.sendMessage({
    action: 'deleteEmailGmail',
    emailId: threadId,
    emailData: unsendContext,
  }, (response) => {
    if (response && response.success) {
      button.textContent = '✓ Unsent';
      button.style.backgroundColor = '#4caf50';
      button.disabled = true;

      // Show success notification
      showRecallNotification('success', `Email to "${emailInfo.recipients[0]}" unsent from sent folder`);

      // Remove the row after a delay (optional)
      setTimeout(() => {
        const emailRow = button.closest('[role="row"]');
        if (emailRow) {
          emailRow.style.opacity = '0.5';
        }
      }, 500);
    } else {
      button.textContent = '✗ Failed';
      button.style.backgroundColor = '#d32f2f';
      button.disabled = false;

      showRecallNotification('error', response.error || 'Failed to unsend email');
    }

    // Record unsend attempt
    chrome.runtime.sendMessage({
      action: 'recordUnsendAttempt',
      data: {
        ...unsendContext,
        success: response.success,
        error: response.error,
      },
    });

    delete activeUnsends[threadId];
  });
}

/**
 * Show notification for recall unsend
 */
function showRecallNotification(type, message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px;
    background-color: ${type === 'success' ? '#4caf50' : '#d32f2f'};
    color: white;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 10001;
    animation: slideIn 0.3s ease-out;
  `;

  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGmail);
} else {
  initializeGmail();
}
