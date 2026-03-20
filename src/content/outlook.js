/**
 * Outlook Content Script
 * Injects unsend UI and detects send events
 * Supports both quick undo and recall (unsend from sent folder)
 */

console.log('[Email Unsender] Outlook content script loaded');

let emailSendContext = null;
let unsendTimer = null;
let activeUnsends = {}; // Track active unsend windows by email ID

/**
 * Initialize content script
 */
function initializeOutlook() {
  // Monitor for send button clicks
  monitorSendButton();
  
  // Monitor for sent folder view (recall functionality)
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

  // Look for Outlook's send button variations:
  // - [id*="send-button"]
  // - [aria-label*="Send"]
  // - [title*="Send"]
  // - Outlook uses "Send" in various attributes
  const sendButtons = element.querySelectorAll(
    '[id*="send"], [aria-label*="Send"], [title*="Send"]'
  );

  sendButtons.forEach((btn) => {
    // Check if it's actually a send button (not another button with "send" in it)
    const isRealSendButton = 
      btn.id?.includes('send') ||
      btn.getAttribute('aria-label')?.toLowerCase().includes('send') === true ||
      btn.getAttribute('title')?.toLowerCase().includes('send') === true;

    if (isRealSendButton && !btn.classList.contains('eunsend-hooked')) {
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
  
  // Extract email data from compose area
  const emailData = extractEmailData();
  
  emailSendContext = {
    provider: 'outlook',
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

    // Wait for email to be sent, then show UI
    setTimeout(() => {
      captureEmailIdAndShowUI(timeWindow);
    }, 500);
  });
}

/**
 * Extract email data from Outlook compose area
 */
function extractEmailData() {
  try {
    const recipients = [];

    // Look for recipient inputs in Outlook compose
    const recipientInputs = document.querySelectorAll(
      '[aria-label*="To"], [aria-label*="to"], input[name="to"]'
    );

    recipientInputs.forEach((input) => {
      if (input.value) {
        recipients.push(...input.value.split(/[,;]/).map(e => e.trim()).filter(e => e));
      }
    });

    // Fallback: look for recipient chips/pills
    if (recipients.length === 0) {
      const chips = document.querySelectorAll('[role="button"][data-tooltip*="@"]');
      chips.forEach((chip) => {
        const email = chip.textContent?.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0];
        if (email) recipients.push(email);
      });
    }

    const subject = extractSubject();

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
 * Extract email subject from Outlook compose
 */
function extractSubject() {
  try {
    // Look for subject input
    const subjectInputs = document.querySelectorAll(
      '[aria-label*="Subject"], input[name="subject"]'
    );
    
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
 */
function captureEmailIdAndShowUI(timeWindow) {
  let emailId = extractRecentEmailId();

  if (!emailId) {
    console.warn('[Email Unsender] Could not extract email ID, using timestamp');
    emailId = `${emailSendContext.timestamp}`;
  }

  emailSendContext.emailId = emailId;
  activeUnsends[emailId] = emailSendContext;

  // Show unsend UI with countdown
  showUnsendUI(emailId, timeWindow);
}

/**
 * Extract recently sent email ID
 */
function extractRecentEmailId() {
  try {
    // Look for email data attributes in recently sent messages
    const emailElements = document.querySelectorAll('[data-item-id], [data-id]');
    
    if (emailElements.length > 0) {
      // Get a recent email ID
      const lastEmail = emailElements[emailElements.length - 1];
      return lastEmail.getAttribute('data-item-id') || lastEmail.getAttribute('data-id');
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
      background-color: #0078d4;
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
        notification.style.backgroundColor = '#107c10';
        notification.innerHTML = `<strong>✓ Email unsent successfully!</strong>`;
        setTimeout(() => notification.remove(), 2000);
      } else {
        notification.style.backgroundColor = '#c50f1f';
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
 * Perform unsend action via Microsoft Graph API
 */
function performUnsend(emailId, callback) {
  if (!activeUnsends[emailId]) {
    if (callback) callback({ success: false, error: 'Email context expired' });
    return;
  }

  console.log('[Email Unsender] Attempting to unsend email:', emailId);

  // Call background worker to delete via Microsoft Graph API
  chrome.runtime.sendMessage({
    action: 'deleteEmailOutlook',
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

    delete activeUnsends[emailId];
  });
}

/**
 * PHASE 4: RECALL - Monitor for sent folder view and inject unsend buttons
 */
function monitorSentFolder() {
  // Use MutationObserver to detect when emails are loaded
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
  if (!checkIfSentFolder()) return;

  // Find all email rows in Outlook's list view
  const emailRows = document.querySelectorAll('[role="option"][data-item-id]');
  
  emailRows.forEach((row) => {
    const itemId = row.getAttribute('data-item-id');
    if (!itemId) return;

    if (row.classList.contains('eunsend-recall-processed')) {
      return;
    }

    row.classList.add('eunsend-recall-processed');

    const emailInfo = extractEmailInfoFromRow(row);
    addUnsendButtonToRow(row, itemId, emailInfo);
  });
}

/**
 * Determine if we're viewing the sent folder
 */
function checkIfSentFolder() {
  try {
    // Check navigation/folder indicators in Outlook
    const navElements = document.querySelectorAll('[role="treeitem"], [aria-label*="Sent"]');
    
    for (let elem of navElements) {
      const label = elem.getAttribute('aria-label') || elem.textContent;
      if (label?.includes('Sent') && (elem.getAttribute('aria-selected') === 'true' || elem.classList.contains('is-selected'))) {
        return true;
      }
    }

    // Fallback: check page content
    const pageTitle = document.querySelector('[role="heading"]')?.textContent || '';
    return pageTitle.includes('Sent');
  } catch (err) {
    console.error('[Email Unsender] Error checking for sent folder:', err);
    return false;
  }
}

/**
 * Extract email information from a row
 */
function extractEmailInfoFromRow(row) {
  try {
    const itemId = row.getAttribute('data-item-id');
    
    // Extract sender/from
    const senderElement = row.querySelector('[role="gridcell"]');
    const sender = senderElement?.textContent?.trim() || 'Unknown';

    // Extract subject
    const subjectElement = row.querySelectorAll('[role="gridcell"]')[1];
    const subject = subjectElement?.textContent?.trim() || '(no subject)';

    // Extract recipients (in sent folder, these are the "To" addresses)
    const recipients = extractRecipientsFromRow(row);

    return {
      itemId,
      sender,
      subject,
      recipients: recipients.length > 0 ? recipients : ['Unknown'],
    };
  } catch (err) {
    console.error('[Email Unsender] Error extracting email info:', err);
    return {
      itemId: '',
      sender: 'Unknown',
      subject: '(no subject)',
      recipients: ['Unknown'],
    };
  }
}

/**
 * Extract recipient addresses from row
 */
function extractRecipientsFromRow(row) {
  try {
    const cells = row.querySelectorAll('[role="gridcell"]');
    const recipients = [];

    cells.forEach((cell) => {
      const text = cell.textContent;
      // Simple email regex
      const emailMatches = text.match(/[\w.-]+@[\w.-]+\.\w+/g);
      if (emailMatches) {
        recipients.push(...emailMatches);
      }
    });

    return [...new Set(recipients)];
  } catch (err) {
    return [];
  }
}

/**
 * Add an unsend button to an email row (revealed on hover)
 */
function addUnsendButtonToRow(row, itemId, emailInfo) {
  try {
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

    const unsendBtn = document.createElement('button');
    unsendBtn.className = 'eunsend-recall-button';
    unsendBtn.textContent = 'Unsend';
    unsendBtn.style.cssText = `
      padding: 6px 12px;
      background-color: #c50f1f;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: background-color 0.2s;
    `;

    unsendBtn.addEventListener('mouseover', () => {
      unsendBtn.style.backgroundColor = '#a4081c';
    });

    unsendBtn.addEventListener('mouseout', () => {
      unsendBtn.style.backgroundColor = '#c50f1f';
    });

    unsendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleRecallUnsend(itemId, emailInfo, unsendBtn);
    });

    buttonContainer.appendChild(unsendBtn);

    if (getComputedStyle(row).position === 'static') {
      row.style.position = 'relative';
    }

    row.appendChild(buttonContainer);

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
 * Handle unsend from sent folder (Outlook Recall)
 */
function handleRecallUnsend(itemId, emailInfo, button) {
  console.log('[Email Unsender] Unsending from Outlook sent folder:', itemId, emailInfo);

  button.disabled = true;
  button.textContent = 'Unsending...';
  button.style.backgroundColor = '#999';

  const unsendContext = {
    provider: 'outlook',
    type: 'recall',
    timestamp: Date.now(),
    recipients: emailInfo.recipients,
    subject: emailInfo.subject,
    sender: emailInfo.sender,
    emailId: itemId,
  };

  activeUnsends[itemId] = unsendContext;

  chrome.runtime.sendMessage({
    action: 'deleteEmailOutlook',
    emailId: itemId,
    emailData: unsendContext,
  }, (response) => {
    if (response && response.success) {
      button.textContent = '✓ Unsent';
      button.style.backgroundColor = '#107c10';
      button.disabled = true;

      showRecallNotification('success', `Email to "${emailInfo.recipients[0]}" unsent from sent folder`);

      setTimeout(() => {
        const emailRow = button.closest('[role="option"]');
        if (emailRow) {
          emailRow.style.opacity = '0.5';
        }
      }, 500);
    } else {
      button.textContent = '✗ Failed';
      button.style.backgroundColor = '#c50f1f';
      button.disabled = false;

      showRecallNotification('error', response.error || 'Failed to unsend email');
    }

    chrome.runtime.sendMessage({
      action: 'recordUnsendAttempt',
      data: {
        ...unsendContext,
        success: response.success,
        error: response.error,
      },
    });

    delete activeUnsends[itemId];
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
    background-color: ${type === 'success' ? '#107c10' : '#c50f1f'};
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
  document.addEventListener('DOMContentLoaded', initializeOutlook);
} else {
  initializeOutlook();
}
