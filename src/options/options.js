/**
 * Options page script
 * Manages settings, account management, and history display
 */

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadAccounts();
  loadHistory();
  setupEventListeners();
});

function loadSettings() {
  chrome.storage.local.get(['timeWindow', 'notifySuccess', 'notifyFailure'], (result) => {
    const timeWindow = result.timeWindow || 60;
    const notifySuccess = result.notifySuccess !== false;
    const notifyFailure = result.notifyFailure !== false;

    document.getElementById('time-window-slider').value = timeWindow;
    document.getElementById('time-window-value').textContent = formatSeconds(timeWindow);
    document.getElementById('notify-success').checked = notifySuccess;
    document.getElementById('notify-failure').checked = notifyFailure;
  });
}

function loadAccounts() {
  chrome.runtime.sendMessage({ action: 'getAccounts' }, (response) => {
    const accountsList = document.getElementById('accounts-list');
    accountsList.innerHTML = '';

    if (response.accounts && response.accounts.length > 0) {
      response.accounts.forEach((account) => {
        const accountDiv = document.createElement('div');
        accountDiv.className = 'account-item';
        accountDiv.innerHTML = `
          <div class="account-info">
            <p class="account-email">${account.email}</p>
            <p class="account-provider">${account.provider}</p>
          </div>
          <button class="btn-remove-account" data-account-id="${account.id}">Remove</button>
        `;
        accountDiv.querySelector('.btn-remove-account').addEventListener('click', () => {
          removeAccount(account.id);
        });
        accountsList.appendChild(accountDiv);
      });
    } else {
      accountsList.innerHTML = '<p style="color: #9aa0a6;">No accounts connected</p>';
    }
  });
}

function loadHistory() {
  chrome.storage.local.get(['unsendHistory'], (result) => {
    const history = result.unsendHistory || [];
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';

    if (history.length === 0) {
      historyList.innerHTML = '<div class="history-empty">No unsend history yet</div>';
    } else {
      // Show last 20 items
      history.slice(-20).reverse().forEach((item) => {
        const historyDiv = document.createElement('div');
        historyDiv.className = 'history-item';
        const timestamp = new Date(item.timestamp).toLocaleString();
        historyDiv.innerHTML = `
          <strong>${item.subject || '(no subject)'}</strong> - ${item.provider}<br>
          To: ${item.recipients.join(', ')}<br>
          <span class="history-timestamp">${timestamp} - <strong>${item.success ? 'Success' : 'Failed'}</strong></span>
        `;
        historyList.appendChild(historyDiv);
      });
    }
  });
}

function setupEventListeners() {
  document.getElementById('time-window-slider').addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    document.getElementById('time-window-value').textContent = formatSeconds(value);
  });

  document.getElementById('save-btn').addEventListener('click', saveSettings);
  document.getElementById('add-account-btn').addEventListener('click', addAccount);
  document.getElementById('clear-history-btn').addEventListener('click', clearHistory);
}

function saveSettings() {
  const timeWindow = parseInt(document.getElementById('time-window-slider').value);
  const notifySuccess = document.getElementById('notify-success').checked;
  const notifyFailure = document.getElementById('notify-failure').checked;

  chrome.storage.local.set({
    timeWindow,
    notifySuccess,
    notifyFailure,
  }, () => {
    showSaveStatus('Settings saved!');
  });
}

function removeAccount(accountId) {
  if (confirm('Remove this account? You can add it back later.')) {
    chrome.runtime.sendMessage({ action: 'removeAccount', accountId }, (response) => {
      if (response.success) {
        loadAccounts();
      } else {
        alert(`Failed to remove account: ${response.error}`);
      }
    });
  }
}

function addAccount() {
  // This will be triggered from popup; for now, show instructions
  alert('Please use the popup to sign in with a new account.');
}

function clearHistory() {
  if (confirm('This will permanently delete all unsend history. Continue?')) {
    chrome.storage.local.set({ unsendHistory: [] }, () => {
      loadHistory();
      showSaveStatus('History cleared.');
    });
  }
}

function showSaveStatus(message) {
  const status = document.getElementById('save-status');
  status.textContent = message;
  setTimeout(() => {
    status.textContent = '';
  }, 3000);
}

function formatSeconds(seconds) {
  if (seconds < 60) {
    return `${seconds} sec`;
  }
  return `${Math.round(seconds / 60)} min`;
}
