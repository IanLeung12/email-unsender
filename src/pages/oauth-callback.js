/**
 * OAuth Callback Handler
 * This page handles the OAuth redirect and extracts the authorization code
 */

function handleOAuthCallback() {
  try {
    // Get the URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (error) {
      // OAuth error occurred
      const errorMsg = errorDescription || error;
      console.error('[Email Unsender] OAuth error:', errorMsg);
      showError(`Authorization failed: ${errorMsg}`);
      
      // Send error back to opener
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'oauth_code',
            error: errorMsg,
          },
          '*'
        );
      }
      
      setTimeout(() => window.close(), 3000);
      return;
    }

    if (!code) {
      console.warn('[Email Unsender] No authorization code in URL');
      showError('No authorization code received. Please try again.');
      
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'oauth_code',
            error: 'No authorization code received',
          },
          '*'
        );
      }
      
      setTimeout(() => window.close(), 3000);
      return;
    }

    // Success - send code back to opener
    console.log('[Email Unsender] Received authorization code');
    showSuccess();
    
    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'oauth_code',
          code,
        },
        '*'
      );
      
      // Close window after 1 second
      setTimeout(() => window.close(), 1000);
    } else {
      console.warn('[Email Unsender] No opener window - cannot send OAuth code');
      showError('Unable to communicate with extension. Please try again.');
      setTimeout(() => window.close(), 3000);
    }
  } catch (error) {
    console.error('[Email Unsender] OAuth callback error:', error);
    showError(`Error: ${error.message}`);
    setTimeout(() => window.close(), 3000);
  }
}

function showError(message) {
  const errorEl = document.getElementById('error-message');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
  
  const spinner = document.querySelector('.spinner');
  if (spinner) spinner.style.display = 'none';
  
  const heading = document.querySelector('h1');
  if (heading) heading.textContent = 'Authorization Failed';
  
  const description = document.querySelector('p');
  if (description) description.textContent = 'An error occurred during authorization.';
}

function showSuccess() {
  const successEl = document.getElementById('success-message');
  if (successEl) {
    successEl.style.display = 'block';
  }
  
  const spinner = document.querySelector('.spinner');
  if (spinner) spinner.style.display = 'none';
  
  const heading = document.querySelector('h1');
  if (heading) heading.textContent = 'Authorization Successful';
  
  const description = document.querySelector('p');
  if (description) description.textContent = 'You have been successfully authorized.';
}

// Handle page load
document.addEventListener('DOMContentLoaded', () => {
  handleOAuthCallback();
});

// Also run immediately in case DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handleOAuthCallback);
} else {
  handleOAuthCallback();
}
