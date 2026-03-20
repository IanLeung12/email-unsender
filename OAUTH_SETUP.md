# OAuth Setup Guide

This guide walks you through setting up OAuth credentials for **Gmail** and **Outlook** so the Email Unsender extension can actually delete emails via their APIs.

## Prerequisites

- A Google account (for Gmail)
- A Microsoft account (for Outlook)
- Administrator access to your accounts

---

## 1. Google OAuth Setup (Gmail)

### Step 1.1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the **project dropdown** at the top
3. Click **"NEW PROJECT"**
4. Name it: `Email Unsender`
5. Click **"CREATE"**
6. Wait for the project to be created

### Step 1.2: Enable Gmail API

1. In the left sidebar, go to **APIs & Services** → **Library**
2. Search for **"Gmail API"**
3. Click on the Gmail API result
4. Click **"ENABLE"**
5. Wait for the API to be enabled

### Step 1.3: Create OAuth Client Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **"+ CREATE CREDENTIALS"** → **OAuth 2.0 Client ID**
3. If prompted, configure the OAuth consent screen first:
   - Click **"Configure Consent Screen"**
   - Choose **"External"** as User Type
   - Click **"CREATE"**
   - Fill in:
     - **App name**: `Email Unsender`
     - **User support email**: Your email
     - **Developer contact**: Your email
   - Click **"SAVE AND CONTINUE"**
   - On "Scopes" screen, click **"ADD OR REMOVE SCOPES"**
   - Search for and select: `gmail.modify`
   - Click **"UPDATE"** and **"SAVE AND CONTINUE"**
   - Click **"SAVE AND CONTINUE"** on Test users screen
   - Review and click **"BACK TO DASHBOARD"**

4. Now create the OAuth Client:
   - Go back to **Credentials**
   - Click **"+ CREATE CREDENTIALS"** → **OAuth 2.0 Client ID**
   - Select **"Web application"**
   - Name it: `Email Unsender Extension`
   - Under **Authorized redirect URIs**, click **"ADD URI"**
   - Add: `https://PLACEHOLDER/oauth-callback` (we'll update this with your actual extension ID)
   - Click **"CREATE"**

5. You should now see a popup with:
   - **Client ID** (copy this)
   - **Client Secret** (copy this)
   - Click **"Download JSON"** to save credentials

### Step 1.4: Get Your Extension ID

1. Load the extension in Firefox (see main README)
2. Go to `about:debugging` → Find "Email Unsender"
3. Copy the ID shown (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### Step 1.5: Update Redirect URI

1. Go back to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **Credentials**
3. Click on your **OAuth 2.0 Client ID** to edit it
4. Under **Authorized redirect URIs**, update the URI to:
   ```
   https://YOUR_EXTENSION_ID.invalid/oauth-callback
   ```
   (Replace `YOUR_EXTENSION_ID` with the ID from Step 1.4)
5. Click **"SAVE"**

---

## 2. Microsoft OAuth Setup (Outlook)

### Step 2.1: Register an Application

1. Go to [Azure Portal](https://portal.azure.com/)
2. Go to **Azure Active Directory** → **App registrations**
3. Click **"New registration"**
4. Name: `Email Unsender`
5. Choose **"Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)"**
6. For Redirect URI:
   - Platform: **Web**
   - URI: `https://PLACEHOLDER/oauth-callback` (will update with extension ID)
7. Click **"Register"**

### Step 2.2: Create Client Secret

1. Go to **Certificates & secrets**
2. Click **"New client secret"**
3. Description: `Email Unsender`
4. Expires: **24 months** (or as desired)
5. Click **"Add"**
6. **Copy the Value** (not the ID) - this is your Client Secret
7. Also copy the **Client ID** from the Overview page

### Step 2.3: Configure API Permissions

1. Go to **API permissions**
2. Click **"Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Delegated permissions"**
5. Search for and select:
   - `Mail.ReadWrite`
   - `Mail.Send`
   - `offline_access`
6. Click **"Add permissions"**
7. Click **"Grant admin consent"** (if prompted) or ask your admin

### Step 2.4: Update Redirect URI

1. Go to **Authentication**
2. Under **Redirect URIs**, update the Web URI to:
   ```
   https://YOUR_EXTENSION_ID.invalid/oauth-callback
   ```
   (Replace `YOUR_EXTENSION_ID` with the ID from Google setup Step 1.4)
3. Click **"Save"**

---

## 3. Configure Email Unsender Extension

### Step 3.1: Add Credentials to Extension

For now, the extension reads OAuth credentials from `localStorage` variables. You can set them via the browser console:

1. Open Firefox Developer Tools (**F12**)
2. Go to **Console** tab
3. Run these commands (replace with your actual credentials):

```javascript
// Google OAuth
localStorage.setItem('google_client_id', 'YOUR_GOOGLE_CLIENT_ID');
localStorage.setItem('google_client_secret', 'YOUR_GOOGLE_CLIENT_SECRET');

// Microsoft OAuth
localStorage.setItem('microsoft_client_id', 'YOUR_MICROSOFT_CLIENT_ID');
localStorage.setItem('microsoft_client_secret', 'YOUR_MICROSOFT_CLIENT_SECRET');
```

4. Reload the extension (via `about:debugging`)

### Step 3.2: Production Setup (Optional)

For production deployments, you should:

1. Use environment variables instead of `localStorage`
2. Never hardcode client secrets
3. Use server-side token exchange instead of client-side
4. Store refresh tokens securely

See `config/oauth-credentials.example.json` for the expected format.

---

## 4. Test OAuth

Once credentials are configured:

1. Open Gmail or Outlook in Firefox
2. Click the **Email Unsender** extension icon
3. You should see **"Sign in with Google"** and **"Sign in with Outlook"** buttons
4. Click one to start the OAuth flow
5. You'll be redirected to Google/Microsoft to authorize
6. After authorizing, you should see your email in the popup

---

## ⚠️ Troubleshooting

### "Redirect URI mismatch"
- Verify your extension ID matches exactly in the Redirect URI
- Make sure it's formatted as: `https://EXTENSION_ID.invalid/oauth-callback`

### "Invalid client secret"
- Verify you copied the Secret Value (not Secret ID)
- Make sure there are no extra spaces
- Try recreating the secret if it was created long ago

### "Insufficient scopes"
- Verify you added `gmail.modify` (Google) and `Mail.ReadWrite` (Microsoft) scopes
- May need to re-authorize after adding scopes

### "Origin mismatch"
- This is expected and okay - extension URIs with `.invalid` are reserved for testing
- This is not a real security issue for browser extensions

---

## 🔐 Security Notes

- **Never** share your Client Secret
- **Never** hardcode credentials in the extension code
- Client Secrets should be stored securely (server-side in production)
- Refresh tokens should be encrypted in storage
- Revoke credentials immediately if they're compromised

---

## Next Steps

Once OAuth is configured:
- Test unsending emails in Gmail
- Test unsending emails in Outlook
- Set up multiple accounts if desired
- Configure extension settings (time window, notifications)

For issues or questions, see the main README or open an issue on GitHub.
