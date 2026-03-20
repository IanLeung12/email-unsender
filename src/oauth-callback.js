/**
 * OAuth Callback Handler
 * Extracts authorization code from URL and sends it back to background worker
 */

(function() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  const statusEl = document.getElementById('status');

  if (error) {
    console.error('[Email Unsender] OAuth error:', error, errorDescription);
    statusEl.textContent = `Authorization failed: ${errorDescription || error}`;
    
    // Send error to background worker
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({
        type: 'oauth_code',
        error: errorDescription || error,
      }, '*');
    }
    
    setTimeout(() => {
      window.close();
    }, 2000);
    return;
  }

  if (!code) {
    console.error('[Email Unsender] No authorization code received');
    statusEl.textContent = 'Authorization failed: No code received';
    
    // Send error to background worker
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({
        type: 'oauth_code',
        error: 'No authorization code received',
      }, '*');
    }
    
    setTimeout(() => {
      window.close();
    }, 2000);
    return;
  }

  console.log('[Email Unsender] OAuth code received, sending to background worker');
  statusEl.textContent = 'Authorization successful! Closing...';

  // Send code to background worker
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({
      type: 'oauth_code',
      code,
    }, '*');
  } else {
    console.error('[Email Unsender] Opener window not available');
  }

  // Close this window
  setTimeout(() => {
    window.close();
  }, 1000);
})();
