/**
 * Storage helper
 * Wrapper around chrome.storage for easier access
 */

const StorageKeys = {
  SETTINGS: {
    TIME_WINDOW: 'timeWindow',
    NOTIFY_SUCCESS: 'notifySuccess',
    NOTIFY_FAILURE: 'notifyFailure',
  },
  DATA: {
    ACCOUNTS: 'accounts',
    UNSEND_HISTORY: 'unsendHistory',
    ACTIVE_UNSENDS: 'activeUnsends',
  },
};

/**
 * Get value from storage
 */
async function getFromStorage(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[key]);
      }
    });
  });
}

/**
 * Set value in storage
 */
async function setInStorage(key, value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get all settings
 */
async function getSettings() {
  const settings = await getFromStorage(StorageKeys.SETTINGS.TIME_WINDOW);
  return {
    timeWindow: settings || 60,
    notifySuccess: await getFromStorage(StorageKeys.SETTINGS.NOTIFY_SUCCESS) !== false,
    notifyFailure: await getFromStorage(StorageKeys.SETTINGS.NOTIFY_FAILURE) !== false,
  };
}

/**
 * Save settings
 */
async function saveSettings(settings) {
  await setInStorage(StorageKeys.SETTINGS.TIME_WINDOW, settings.timeWindow);
  await setInStorage(StorageKeys.SETTINGS.NOTIFY_SUCCESS, settings.notifySuccess);
  await setInStorage(StorageKeys.SETTINGS.NOTIFY_FAILURE, settings.notifyFailure);
}

/**
 * Add unsend history entry
 */
async function addToHistory(entry) {
  const history = (await getFromStorage(StorageKeys.DATA.UNSEND_HISTORY)) || [];
  history.push({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  
  // Keep only last 200 entries
  const trimmed = history.slice(-200);
  await setInStorage(StorageKeys.DATA.UNSEND_HISTORY, trimmed);
}

/**
 * Get all accounts
 */
async function getAccounts() {
  return (await getFromStorage(StorageKeys.DATA.ACCOUNTS)) || [];
}

/**
 * Add account
 */
async function addAccount(account) {
  const accounts = await getAccounts();
  account.id = Date.now().toString();
  accounts.push(account);
  await setInStorage(StorageKeys.DATA.ACCOUNTS, accounts);
  return account;
}

/**
 * Remove account
 */
async function removeAccount(accountId) {
  const accounts = await getAccounts();
  const filtered = accounts.filter((acc) => acc.id !== accountId);
  await setInStorage(StorageKeys.DATA.ACCOUNTS, filtered);
}

export {
  StorageKeys,
  getFromStorage,
  setInStorage,
  getSettings,
  saveSettings,
  addToHistory,
  getAccounts,
  addAccount,
  removeAccount,
};
