# Email Unsender - Firefox Extension

A Firefox extension providing a second line of defense for Gmail and Outlook users. Unsend emails within a configurable time window or recall already-sent emails.

## Features

- **Quick Undo**: Delete emails within seconds/minutes of sending (configurable 5 sec — 5 min, default 1 min)
- **Recall**: Attempt to recall already-sent emails (best-effort, based on provider limitations)
- **Multi-Provider**: Supports both Gmail and Outlook
- **OAuth Authentication**: Secure sign-in with Google and Microsoft accounts
- **History Tracking**: Local storage of unsent email records (timestamps, recipients, subjects)
- **Configurable Settings**: Customize time window, notification preferences, and manage accounts

## Project Structure

```
src/
├── manifest.json           # Extension metadata and permissions
├── popup/
│   ├── popup.html         # Popup UI
│   ├── popup.css          # Popup styling
│   └── popup.js           # Popup logic and timer display
├── options/
│   ├── options.html       # Settings page
│   ├── options.css        # Settings styling
│   └── options.js         # Settings and history management
├── content/
│   ├── gmail.js           # Gmail content script (send interceptor)
│   └── outlook.js         # Outlook content script (send interceptor)
├── background/
│   └── background.js      # Service worker (OAuth, API calls, storage)
└── utils/
    ├── auth.js            # OAuth flow management
    ├── storage.js         # Chrome storage wrapper
    └── messaging.js       # Message passing helpers

config/
├── oauth-credentials.example.json  # OAuth config template
└── oauth-credentials.json          # (ignored, contains real credentials)

package.json              # Dependencies and build scripts
.gitignore               # Git ignore rules
```

## Setup Instructions

### Prerequisites
- Firefox browser (version 109+)
- Node.js and npm (for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/IanLeung12/email-unsender.git
   cd email-unsender
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up OAuth credentials**
   - Copy example config:
     ```bash
     cp config/oauth-credentials.example.json config/oauth-credentials.json
     ```
   - Update with your OAuth client IDs and secrets (see below)

4. **Load extension in Firefox**
   - Open `about:debugging` in Firefox
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Navigate to `src/manifest.json` and select it
   - Extension should now be loaded and active

### OAuth Setup

#### Google Cloud (for Gmail)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API:
   - Search for "Gmail API" in APIs & Services
   - Click "Enable"
4. Create OAuth 2.0 credential (Web Application):
   - Go to Credentials
   - Click "Create Credentials" → OAuth 2.0 Client ID
   - Select "Web application"
   - Add authorized redirect URI: `https://<extension-id>.invalid/oauth-callback`
   - Copy Client ID and Secret to `config/oauth-credentials.json`

#### Microsoft Azure (for Outlook)

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
4. Name: "Email Unsender"
5. Add redirect URI: `https://<extension-id>.invalid/oauth-callback`
6. Under "Certificates & secrets", create a new client secret
7. Under "API permissions":
   - Add "Mail.ReadWrite" (Microsoft Graph)
   - Add "Mail.Send"
8. Copy Client ID and Secret to `config/oauth-credentials.json`

> **Note**: Get your extension ID after first load in Firefox (shown in about:debugging)

## Development

### Build for production
```bash
npm run build
```

### Watch mode (development)
```bash
npm run dev
```

### Lint code
```bash
npm run lint
```

### Testing
```bash
npm test
```

## Current Status: Phase 1 Complete ✅

**Completed:**
- Project structure and folder organization
- Manifest V3 configuration
- Basic popup UI and settings page
- Content scripts for Gmail and Outlook (skeleton)
- Background service worker (skeleton)
- OAuth helper utilities (skeleton)
- Storage and messaging utilities

**Next Phases:**
1. **Phase 2**: Gmail quick undo implementation
2. **Phase 3**: Gmail recall implementation
3. **Phase 4**: Outlook quick undo + recall
4. **Phase 5**: OAuth flow implementation
5. **Phase 6**: Local storage & history
6. **Phase 7**: Options page functionality
7. **Phase 8**: Error handling & polish
8. **Phase 9**: Testing

## Architecture Overview

### Content Scripts (Gmail / Outlook)
- Monitor DOM for send button clicks
- Extract email metadata (recipients, subject)
- Show unsend countdown UI
- Communicate with background worker

### Background Service Worker
- Manage OAuth tokens and authentication
- Handle Gmail API calls for quick undo/recall
- Handle Microsoft Graph API calls for Outlook
- Store unsend history
- Route messages between components

### Popup
- Show current unsend status and timer
- Display account information
- Provide quick unsend button
- Link to settings

### Options Page
- Configure time window (5 sec — 5 min)
- Manage accounts (sign in / sign out)
- View unsend history
- Notification preferences

## Limitations & Considerations

### Gmail
- Recall only works if recipient hasn't read the email
- Can only delete from your own sent folder; true recall to recipient blocked by Gmail limitations
- Send button detection depends on Gmail's DOM structure

### Outlook
- Recall window is limited (~30 min by default)
- Requires recipient's Outlook to be online for recall
- Same DOM detection challenges as Gmail

### General
- Extension requires active tab to inject content scripts
- OAuth tokens expire and must be refreshed
- Multiple accounts in same browser tab may require user selection for disambiguation

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Troubleshooting

### Extension not loading
- Verify `src/manifest.json` is valid JSON
- Check Firefox console (F12) for errors
- Try reloading the extension (about:debugging → Reload)

### Send button not detected
- Gmail/Outlook DOM structure may have changed
- Check browser console for errors in content scripts
- Report issue with browser/version info

### OAuth fails
- Verify OAuth credentials in `config/oauth-credentials.json`
- Check that redirect URI matches extension ID
- Ensure APIs are enabled in Google/Microsoft consoles

---

**Built with ❤️ for email safety**