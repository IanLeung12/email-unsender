# Email Unsender - Firefox Extension WIP DOES NOT WORK

A Firefox extension providing a second line of defense for Gmail and Outlook users. Unsend emails within a configurable time window or recall already-sent emails.

## Features

- **Quick Undo**: Delete emails within seconds/minutes of sending (configurable 5 sec — 5 min, default 1 min)
- **Recall**: Attempt to recall already-sent emails (best-effort, based on provider limitations)
- **Multi-Provider**: Supports both Gmail and Outlook
- **OAuth Authentication**: Secure sign-in with Google and Microsoft accounts
- **History Tracking**: Local storage of unsent email records (timestamps, recipients, subjects)
- **Configurable Settings**: Customize time window, notification preferences, and manage accounts

## Current Status

### ✅ Completed (Phase 1-5)
- Project structure and Manifest V3 setup
- Gmail quick undo (send interceptor, UI, timer)
- Real Gmail API integration (DELETE messages)
- OAuth framework with token refresh
- Popup interface with sign-in buttons
- Settings/options page
- Unsend history tracking

### 🔄 In Progress / Pending
- **Phase 3**: Gmail Recall (unsend from sent folder)
- **Phase 4**: Outlook Support (quick undo + recall)
- **Phase 6**: Advanced storage features
- **Phase 7-9**: Polish and testing

## Project Structure

```
src/
├── manifest.json                    # Extension metadata and permissions
├── popup/
│   ├── popup.html                  # Popup UI
│   ├── popup.css                   # Popup styling
│   └── popup.js                    # Popup logic and OAuth flow
├── options/
│   ├── options.html                # Settings page
│   ├── options.css                 # Settings styling
│   └── options.js                  # Settings and history management
├── content/
│   ├── gmail.js                    # Gmail content script (send interceptor)
│   └── outlook.js                  # Outlook content script (send interceptor)
├── background/
│   └── background.js               # Background worker (OAuth, API calls, storage)
├── utils/
│   ├── auth.js                     # OAuth flow management
│   ├── storage.js                  # Chrome storage wrapper
│   └── messaging.js                # Message passing helpers
├── pages/
│   ├── oauth-callback.html         # OAuth callback page
│   └── oauth-callback.js           # OAuth callback handler
└── assets/
    ├── icon-16.png
    ├── icon-32.png
    ├── icon-48.png
    └── icon-128.png

config/
├── oauth-credentials.example.json  # OAuth config template
└── oauth-credentials.json          # (ignored, contains real credentials)

package.json                        # Dependencies and build scripts
.gitignore                         # Git ignore rules
README.md                          # This file
```

## Setup Instructions

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/IanLeung12/email-unsender.git
   cd email-unsender
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Load in Firefox**:
   - Go to `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select `src/manifest.json`

### OAuth Setup

The extension requires OAuth credentials from Google and Microsoft to function. Follow the [QUICK_SETUP.md](./QUICK_SETUP.md) guide for step-by-step instructions to:

1. Create Google OAuth credentials
2. Create Microsoft OAuth credentials
3. Store credentials in browser console
4. Test sign-in and unsend functionality

**Estimated time**: 20-30 minutes

### Configuration

See [QUICK_SETUP.md](./QUICK_SETUP.md) for detailed setup instructions or [OAUTH_SETUP.md](./OAUTH_SETUP.md) for in-depth OAuth explanation.

## How It Works

### Gmail Quick Undo Flow

1. User composes email on Gmail
2. Clicks "Send" button
3. Content script intercepts send event
4. Popup shows countdown timer (default 1 minute)
5. User can click "Unsend" within the time window
6. Extension calls Gmail API to delete message from sent folder
7. Notification shows success/failure

### OAuth Authentication

1. User clicks "Sign in with Google/Outlook"
2. Popup opens OAuth authorization window
3. User grants permission to the extension
4. OAuth provider returns authorization code
5. Extension exchanges code for access/refresh tokens
6. Tokens stored in `chrome.storage.local`
7. Email address displayed in popup

## Testing

### Manual Testing Checklist

- [ ] Extension loads in Firefox without errors
- [ ] Popup displays correctly
- [ ] OAuth sign-in opens authorization window
- [ ] Email address appears in popup after sign-in
- [ ] Settings page opens and functions properly
- [ ] Send button interceptor works on Gmail
- [ ] Unsend countdown timer displays correctly
- [ ] Unsend button deletes email from sent folder
- [ ] History is recorded and displayed

### Console Logging

The extension logs to browser console with `[Email Unsender]` prefix. To view:
1. Press `F12` to open Developer Tools
2. Click "Console" tab
3. Look for `[Email Unsender]` messages

## Development

### Adding Features

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes in `src/` directory
3. Test in Firefox (`about:debugging`)
4. Commit with clear message: `git commit -m "feat: description"`
5. Push to branch: `git push origin feature/your-feature`
6. Create pull request with description

### Code Style

- Use vanilla JavaScript (no frameworks)
- Include console logging with `[Email Unsender]` prefix for debugging
- Add comments for complex logic
- Use descriptive variable/function names

## Troubleshooting

### OAuth Credentials Not Recognized
- Verify you followed [QUICK_SETUP.md](./QUICK_SETUP.md) correctly
- Check browser console (F12) for error messages
- Ensure redirect URI matches exactly in OAuth app configuration
- Try refreshing the page or reopening popup

### Sign-In Window Won't Open
- Check if browser has popup blocking enabled
- Allow popups for mail.google.com and outlook.live.com
- Try a different browser to verify OAuth app configuration

### Unsend Not Working
- Verify you're signed in (email shown in popup)
- Check that email is within configured time window
- Look for error messages in browser console (F12)
- Verify Gmail API permissions in your OAuth app

### Extension Won't Load
- Check Manifest V3 compatibility
- Verify all referenced files exist in `src/`
- Check browser console for parsing errors
- Try removing and reloading the extension

## Architecture

### Message Passing Flow

```
Content Script (gmail.js)
  ↓ (chrome.runtime.sendMessage)
  ↓
Background Worker (background.js)
  ↓ (handles action, calls API)
  ↓
Result sent back to Content Script
  ↓ (chrome.runtime.sendMessage callback)
  ↓
Content Script updates UI
```

### Token Management

- Access tokens checked before each API call
- If token within 5 minutes of expiration, automatically refreshed
- Refresh tokens stored securely in chrome.storage.local
- Invalid tokens trigger re-authentication

### Storage Structure

```javascript
// chrome.storage.local
{
  "accounts": [
    {
      "id": "google_12345...",
      "provider": "google",
      "email": "user@gmail.com",
      "accessToken": "...",
      "refreshToken": "...",
      "expiresAt": 1234567890
    }
  ],
  "activeUnsends": {
    "emailId1": {
      "expiresAt": 1234567890,
      "to": ["recipient@example.com"],
      "subject": "Email subject"
    }
  },
  "unsendHistory": [
    {
      "timestamp": "2024-03-20T10:30:00Z",
      "email": "user@gmail.com",
      "recipient": "recipient@example.com",
      "success": true
    }
  ],
  "timeWindow": 60,
  "notifySuccess": true,
  "notifyFailure": true
}
```

## API References

- [Gmail API - Delete Messages](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/delete)
- [Microsoft Graph - Delete Mail Folder Messages](https://learn.microsoft.com/en-us/graph/api/message-delete)
- [Chrome Extension Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Chrome Extension Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging/)

## License

MIT License - feel free to use, modify, and distribute

## Support

For issues, questions, or feature requests, please open a GitHub issue with:
- Description of the problem
- Steps to reproduce
- Browser version and OS
- Console error messages (from F12)

---

**Version**: 0.1.0  
**Last Updated**: March 20, 2026  
**Status**: Active Development (Phase 5 complete)
