# Email Unsender - Quick Setup Checklist

## 📋 Pre-Setup (Do This Once)

### Get Extension ID
- [ ] Load extension in Firefox (`about:debugging` → Load Temporary Add-on)
- [ ] Copy your extension ID from `about:debugging`
- [ ] Save it somewhere (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

---

## 🔑 Google OAuth Setup (Gmail)

### Google Cloud Console
- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Create new project: "Email Unsender"
- [ ] Go to APIs & Services → Library
- [ ] Enable "Gmail API"
- [ ] Go to Credentials
- [ ] Configure OAuth Consent Screen:
  - [ ] Choose "External"
  - [ ] Fill app name, emails
  - [ ] Add scope: `gmail.modify`
  - [ ] Add test user (your email)
- [ ] Create OAuth 2.0 Client ID (Web application):
  - [ ] Name: "Email Unsender Extension"
  - [ ] Add Redirect URI: `https://EXTENSION_ID.invalid/oauth-callback` (use your ID from above)
  - [ ] Download JSON file
  - [ ] **Copy Client ID** ← Save this
  - [ ] **Copy Client Secret** ← Save this

---

## 🔑 Microsoft OAuth Setup (Outlook)

### Azure Portal
- [ ] Go to [Azure Portal](https://portal.azure.com/)
- [ ] Azure Active Directory → App registrations
- [ ] New registration:
  - [ ] Name: "Email Unsender"
  - [ ] Choose "Multitenant + personal accounts"
  - [ ] Certificate & Secrets → New client secret
  - [ ] **Copy Secret Value** ← Save this
  - [ ] Overview → **Copy Client ID** ← Save this
- [ ] API permissions → Add permission:
  - [ ] Select "Microsoft Graph"
  - [ ] Add delegated permissions:
    - [ ] Mail.ReadWrite
    - [ ] Mail.Send
    - [ ] offline_access
- [ ] Authentication → Add Redirect URI:
  - [ ] `https://EXTENSION_ID.invalid/oauth-callback` (use your extension ID)

---

## 💾 Store Credentials in Extension

### Browser Console
- [ ] Open Firefox DevTools (F12)
- [ ] Go to **Console** tab
- [ ] Paste these commands (replace YOUR_... with actual values):

```javascript
// Save Google credentials
localStorage.setItem('google_client_id', 'YOUR_GOOGLE_CLIENT_ID');
localStorage.setItem('google_client_secret', 'YOUR_GOOGLE_CLIENT_SECRET');

// Save Microsoft credentials
localStorage.setItem('microsoft_client_id', 'YOUR_MICROSOFT_CLIENT_ID');
localStorage.setItem('microsoft_client_secret', 'YOUR_MICROSOFT_CLIENT_SECRET');
```

- [ ] Press Enter
- [ ] Verify all 4 lines executed
- [ ] Go to `about:debugging`
- [ ] Click "Reload" on Email Unsender

---

## 🧪 Test OAuth Sign-In

### Test Gmail Sign-In
- [ ] Open [Gmail](https://mail.google.com)
- [ ] Click Email Unsender icon (top-right)
- [ ] Click **"Sign in with Google"**
- [ ] Follow Google login if needed
- [ ] Grant permission when prompted
- [ ] Popup should show your email address
- [ ] ✅ If you see your email, sign-in works!

### Test Outlook Sign-In
- [ ] Open [Outlook](https://outlook.office.com)
- [ ] Click Email Unsender icon
- [ ] Click **"Sign in with Outlook"**
- [ ] Follow Microsoft login if needed
- [ ] Grant permission when prompted
- [ ] Popup should show your email address
- [ ] ✅ If you see your email, sign-in works!

---

## 🚀 Test Unsend Feature

### Test in Gmail
- [ ] Go to Gmail (with access token set up)
- [ ] Click "Compose"
- [ ] Fill To, Subject, Bodyif you use a test email)
- [ ] Click "Send"
- [ ] Watch for notification with **"Unsend"** button
- [ ] Click **"Unsend"** within 60 seconds
- [ ] Check notification color:
  - [ ] 🟢 Green = Success (email deleted)
  - [ ] 🔴 Red = Failed (probably already read/deleted)
- [ ] Go to Sent folder → verify email is deleted

### Test in Outlook
- [ ] Similar steps as Gmail
- [ ] Compose → Send → Unsend
- [ ] Check sent folder

---

## 🐛 Troubleshooting Checklist

### OAuth Credentials Not Working?
- [ ] Verify Client ID/Secret copied correctly (no extra spaces)
- [ ] Verify Redirect URI includes your extension ID
- [ ] Verify Redirect URI ends with `.invalid/oauth-callback`
- [ ] Make **sure** scopes are added (Mail.ReadWrite for Outlook, gmail.modify for Google)
- [ ] Try reloading extension after saving credentials
- [ ] Try clearing localStorage and re-entering credentials

### Sign-In Opens Blank/Error Page?
- [ ] Check that Client ID is correct (should be alphanumeric + numbers)
- [ ] Check that Redirect URI is registered in Google/Microsoft console
- [ ] Try in private/incognito window (rules out browser cache)
- [ ] Check browser console (F12) for errors

### Unsend Says "No Gmail Account Signed In"?
- [ ] Make sure you clicked "Sign in with Google" first and authorized
- [ ] Check that credentials are stored (`localStorage.getItem('google_client_id')`)
- [ ] Try signing out and signing in again

### Email Not Deleted After Unsend?
- [ ] Email might already have been read/deleted
- [ ] You might be past the 60-second window (adjust in settings)
- [ ] Check the notification color (red = API error)
- [ ] Check browser console (F12) for error details

---

## 📊 Success Indicators

✅ **You're all set if**:
- [ ] Gmail sign-in works (email shows in popup)
- [ ] Outlook sign-in works (email shows in popup)
- [ ] Unsend notification appears with timer
- [ ] Clicking "Unsend" shows green success notification
- [ ] Email disappears from sent folder

❓ **Still having issues?**
Check [OAUTH_SETUP.md](OAUTH_SETUP.md) for detailed steps, or review [STATUS.md](STATUS.md) for architecture details.

---

## 🎉 Next: Test Full Workflow

Once everything works:
1. **Adjust time window** (settings) if you want longer/shorter unsend window
2. **Check unsend history** (in Options page) to see recorded attempts
3. **Invite others to test** (they'll need their own OAuth credentials)
4. **Report issues** on GitHub with reproduction steps

You're done with OAuth setup! Time to use the extension. 🚀
