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

### Quick Start (5 minutes)

1. **Load the extension in Firefox**
   - Open `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select `src/manifest.json`

2. **Set up OAuth credentials** (see [QUICK_SETUP.md](QUICK_SETUP.md))
   - Create Google OAuth app (5 min)
   - Create Microsoft OAuth app (5 min)
   - Store credentials in browser (`localStorage` commands)

3. **Test it out**
   - Go to Gmail/Outlook
   - Compose and send email
   - Click "Unsend" button within 60 seconds
   - Email should be deleted

### Detailed Guides
- **[QUICK_SETUP.md](QUICK_SETUP.md)** — Fast checklist (recommended for new users)
- **[OAUTH_SETUP.md](OAUTH_SETUP.md)** — Step-by-step OAuth configuration
- **[STATUS.md](STATUS.md)** — Current implementation status & roadmap

### Advanced Setup (Development)

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
   - Follow [OAUTH_SETUP.md](OAUTH_SETUP.md) for detailed steps
   - Store credentials via browser console (see [QUICK_SETUP.md](QUICK_SETUP.md))

4. **Load extension in Firefox**
   - Open `about:debugging`
   - Click "Load Temporary Add-on"
   - Select `src/manifest.json`

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

## Current Status: Phase 5 Complete ✅

**Completed:**
- ✅ Phase 1: Project structure and folder organization
- ✅ Phase 2: Gmail quick undo (send button detection, timer, unsend UI)
- ✅ Phase 5: OAuth authentication framework (token management, real API calls)

**Fully Functional** (Ready to test):
- Gmail send interception with countdown timer
- OAuth sign-in for Google and Microsoft
- Real Gmail API email deletion
- Unsend history tracking
- Settings page (time window, notifications, account management)

**In Progress / Roadmap:**
- Phase 3: Gmail recall (unsend from sent folder)
- Phase 4: Outlook support (quick undo + recall)
- Phase 6: Enhanced local storage & history
- Phase 7: Options page full functionality
- Phase 8: Error handling & polish
- Phase 9: Comprehensive testing

**For detailed status and remaining work**, see [STATUS.md](STATUS.md)

**For quick setup**, see [QUICK_SETUP.md](QUICK_SETUP.md)

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