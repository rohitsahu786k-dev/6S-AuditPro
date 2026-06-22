@echo off
title 6S AuditPro - Firebase Deploy
color 0A
cls

echo.
echo  ============================================
echo   6S AuditPro - Firebase Deployment
echo   ONEPWS Private Limited
echo  ============================================
echo.

:: ── IMPORTANT: Keep window open on ANY exit path ──────────────
:: This line makes the window stay open even if something fails
if "%1"=="RELAUNCHED" goto START
cmd /k "%~f0" RELAUNCHED
exit

:START
echo  Starting deployment checks...
echo.

:: ── CHECK 1: Was the ZIP extracted? ──────────────────────────
if not exist "%~dp0public\index.html" (
    echo  [ERROR] Cannot find public\index.html
    echo.
    echo  You must EXTRACT the ZIP file before running this script.
    echo  Right-click the ZIP ^> "Extract All" ^> then run DEPLOY.bat
    echo  from inside the extracted folder.
    echo.
    goto DONE
)
echo  [OK] index.html found

:: ── CHECK 2: .firebaserc project ID set? ─────────────────────
findstr /C:"YOUR-FIREBASE-PROJECT-ID" "%~dp0.firebaserc" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo  [ERROR] You have not set your Firebase Project ID yet.
    echo.
    echo  Open the file ".firebaserc" in Notepad and replace:
    echo     YOUR-FIREBASE-PROJECT-ID
    echo  with your actual project ID from Firebase Console.
    echo.
    echo  Example:
    echo     "default": "auditpro-onepws-abc123"
    echo.
    goto DONE
)
echo  [OK] .firebaserc project ID configured

:: ── CHECK 3: Node.js installed? ──────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Node.js is NOT installed on this computer.
    echo.
    echo  Please install it:
    echo  1. Open your browser
    echo  2. Go to: https://nodejs.org
    echo  3. Click the big green LTS button to download
    echo  4. Run the installer (keep all defaults)
    echo  5. RESTART this script after installing
    echo.
    goto DONE
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  [OK] Node.js %NODE_VER% installed

:: ── CHECK 4: npm available? ──────────────────────────────────
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] npm not found. Please reinstall Node.js from nodejs.org
    goto DONE
)
echo  [OK] npm available

:: ── STEP 1: Install Firebase CLI ─────────────────────────────
echo.
echo  ============================================
echo   STEP 1: Installing Firebase CLI...
echo  ============================================
echo.
where firebase >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('firebase --version 2^>nul') do set FB_VER=%%i
    echo  [OK] Firebase CLI already installed: %FB_VER%
) else (
    echo  Installing Firebase CLI (this may take 1-2 minutes)...
    echo  Please wait...
    npm install -g firebase-tools
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] Failed to install Firebase CLI.
        echo  Try running this script as Administrator:
        echo  Right-click DEPLOY.bat ^> Run as administrator
        echo.
        goto DONE
    )
    echo  [OK] Firebase CLI installed successfully
)

:: ── STEP 2: Login to Firebase ────────────────────────────────
echo.
echo  ============================================
echo   STEP 2: Login to Firebase
echo  ============================================
echo.
echo  A browser window will open.
echo  Log in with the Google account that owns
echo  your Firebase project, then come back here.
echo.
echo  Press any key when ready to open browser...
pause >nul

firebase login
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Login failed or was cancelled.
    echo  Please run the script again and complete login in the browser.
    echo.
    goto DONE
)
echo.
echo  [OK] Logged in to Firebase successfully

:: ── STEP 3: Deploy ───────────────────────────────────────────
echo.
echo  ============================================
echo   STEP 3: Deploying to Firebase Hosting...
echo  ============================================
echo.
cd /d "%~dp0"
firebase deploy --only hosting

if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Deployment failed. Common causes:
    echo.
    echo  1. Wrong Project ID in .firebaserc
    echo     Go to Firebase Console ^> Settings ^> copy Project ID
    echo.
    echo  2. Firebase Hosting not enabled
    echo     Go to Firebase Console ^> Build ^> Hosting ^> Get Started
    echo.
    echo  3. Not logged into correct Google account
    echo     Run:  firebase logout
    echo     Then run this script again
    echo.
    goto DONE
)

:: ── SUCCESS ───────────────────────────────────────────────────
echo.
echo  ============================================
echo   DEPLOYMENT SUCCESSFUL!
echo  ============================================
echo.
echo  Your 6S AuditPro portal is now LIVE.
echo.
echo  Share this URL with your team:
echo.
for /f "tokens=2 delims=:}" %%a in ('findstr "default" "%~dp0.firebaserc"') do (
    set PID=%%a
    set PID=!PID: =!
    set PID=!PID:"=!
    set PID=!PID:,=!
)
echo    https://your-project-id.web.app
echo.
echo  (Find exact URL in Firebase Console ^> Hosting)
echo.
echo  Login Credentials:
echo    admin / admin123
echo    auditor / auditor123
echo    stores / stores123
echo    production / production123
echo.

:DONE
echo.
echo  ============================================
echo  Press any key to close this window...
echo  ============================================
pause >nul
