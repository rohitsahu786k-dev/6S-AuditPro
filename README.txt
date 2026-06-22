# 6S AuditPro – Firebase Deployment Package
## ONEPWS Private Limited

---

## BEFORE YOU START — Do These 2 Things First

### 1. Extract the ZIP
Right-click the ZIP file → "Extract All"
Run DEPLOY.bat only from INSIDE the extracted folder.

### 2. Set Your Firebase Project ID
Open `.firebaserc` in Notepad and replace:
```
YOUR-FIREBASE-PROJECT-ID
```
with your actual Project ID from Firebase Console → Settings.

Example:
```json
{ "projects": { "default": "auditpro-onepws-abc123" } }
```

### 3. Set Firebase Config in index.html
Open `public/index.html` in Notepad.
Search for `REPLACE_API_KEY` and fill in all 7 values from:
Firebase Console → Project Settings → Your Apps → SDK Config

---

## DEPLOY — Windows

Double-click `DEPLOY.bat`

The window will guide you through each step and will NOT close automatically.

---

## IF DEPLOY.BAT WON'T WORK — Manual Commands

Open Command Prompt (search "cmd" in Start menu) and type these one by one:

```
Step 1 – Install Firebase CLI:
npm install -g firebase-tools

Step 2 – Login:
firebase login

Step 3 – Go to this folder (adjust path to match where you extracted):
cd C:\Users\YourName\Downloads\firebase-deploy-v2

Step 4 – Deploy:
firebase deploy --only hosting

Step 5 – Get your URL:
firebase hosting:sites:list
```

---

## AFTER DEPLOYMENT

Your live URL will be: `https://YOUR-PROJECT-ID.web.app`

Share this URL with the team. It works on any phone or desktop browser.

Default login credentials:
- admin / admin123
- auditor / auditor123
- stores / stores123
- production / production123

---

## UPDATING THE APP IN FUTURE

1. Replace `public/index.html` with the new HTML file
2. Double-click `DEPLOY.bat` again (no login needed after first time)
3. Done — live URL updates in ~30 seconds
