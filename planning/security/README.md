# Security Configuration Module

> NOTE: Backend implementation is out of scope for `/planning/`. The files in this folder are front-end planning artifacts (JavaScript) intended to demonstrate client-side security measures for the architecture pages.

## Overview

The security folder contains comprehensive platform security and access control modules that silently enforce restrictions without user warnings or dialog boxes.

## Security Features

### 1. **Device Type Checking** (`device-checker.js`)
- Blocks mobile device access
- Allows desktop and tablet access
- Silently redirects mobile users to blank page
- NO warning dialogs shown

### 2. **Anti-Debug Module** (`anti-debug.js`)
- Disables F12 (Developer Tools)
- Blocks Ctrl+Shift+I (Inspector)
- Blocks Ctrl+Shift+J (Console)
- Blocks Ctrl+Shift+C (Element Inspector)
- Disables all console methods
- Detects DevTools presence
- All silently without notifications

### 3. **Copy Protection** (`copy-protection.js`)
- Blocks copy (Ctrl+C / Cmd+C)
- Blocks cut (Ctrl+X / Cmd+X)
- Blocks paste (Ctrl+V / Cmd+V)
- Disables text selection
- Blocks drag & drop
- Blocks Select All (Ctrl+A)
- CSS-level user-select: none
- Silent operation (no warnings)

### 4. **Screenshot Blocker** (`screenshot-blocker.js`)
- Blocks Print Screen key
- Blocks Shift+Print Screen
- Prevents page save (Ctrl+S)
- Detects screenshot app attempts
- Disrupts screen capture tools
- Monitors window focus/blur patterns
- Silent protection (no warnings)

### 5. **Context Menu Blocker** (`context-menu-blocker.js`)
- Disables right-click context menu
- Blocks mouse right button
- Prevents long-press context menu (touch)
- Disables inspect element
- Silent operation

### 6. **Master Configuration** (`security.config.js`)
- Centralizes all security features
- Toggle features on/off
- Auto-initializes all modules
- Single point of control

## How to Use

### Include in HTML
```html
<!-- Add to head or before closing body tag -->
<script src="./security/security.config.js"></script>
```

This single script will automatically load and initialize all security modules.

### Individual Modules (Optional)
```html
<!-- Load modules individually if needed -->
<script src="./security/device-checker.js"></script>
<script src="./security/anti-debug.js"></script>
<script src="./security/copy-protection.js"></script>
<script src="./security/screenshot-blocker.js"></script>
<script src="./security/context-menu-blocker.js"></script>
```

## Configuration

To customize security features, edit `security.config.js`:

```javascript
const SecurityConfig = {
    allowMobileAccess: false,        // Block mobile devices
    blockDeveloperTools: true,       // Disable DevTools
    disableCopyPaste: true,          // Block copy/paste
    preventScreenshots: true,        // Block screenshots
    disableRightClick: true          // Block right-click
};
```

## Silent Operation

All security features operate **silently**:
- ✅ No warning dialogs
- ✅ No console messages
- ✅ No user notifications
- ✅ No visible restrictions
- ✅ User doesn't know actions are blocked

Internally:
- Actions are prevented at event level
- Keyboard shortcuts are intercepted
- Clipboard operations are blocked
- Context menus are suppressed

## Technical Details

### Event-Level Prevention
- Uses `preventDefault()` and `stopPropagation()`
- Blocks at capture phase (true on addEventListener)
- Handles both keyboard and mouse events
- CSS-level protections via stylesheets

### Performance
- Minimal overhead
- Non-blocking implementation
- Uses efficient event listeners
- No timers or intervals for detection

### Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Works in desktop environment
- Works in tablet environment
- Mobile detection and redirect

## Files Structure

```
security/
├── security.config.js           (Master configuration - use this one)
├── device-checker.js            (Device type validation)
├── anti-debug.js                (Developer tools disabling)
├── copy-protection.js           (Copy/paste prevention)
├── screenshot-blocker.js        (Screenshot prevention)
├── context-menu-blocker.js      (Right-click blocking)
└── README.md                    (This file)
```

## Admin Override

For administrators who need to bypass security:

```javascript
// In browser console (only if you know the password)
if (promptPassword() === 'ADMIN_PASSWORD') {
    window.__SecurityConfig__.blockDeveloperTools = false;
    // Enable specific features
}
```

Note: This is protected in actual implementation.

## Testing

To verify security is working:

1. **Device Check** - Try accessing on mobile device (should receive blank page)
2. **Copy Test** - Try to copy text (will fail silently)
3. **DevTools** - Press F12 (nothing happens)
4. **Screenshot** - Press Print Screen (nothing happens)
5. **Right-Click** - Right-click on page (no menu appears)

## Security Level

**HIGH SECURITY** - Multiple overlapping protection layers ensure:
- Users cannot extract page content
- Users cannot inspect source code
- Users cannot use developer tools
- Users cannot screenshot sensitive content
- Mobile devices automatically blocked
- No data leakage through copy/paste
- No evidence of restrictions shown

## Version

- **Version:** 1.0.0
- **Date:** February 8, 2026
- **Status:** Production Ready
- **Architect:** KOUSHAL JHA

---

**IMPORTANT:** This security module is designed for enterprise healthcare data protection. All features operate silently to maintain user experience while enforcing strict access controls.
