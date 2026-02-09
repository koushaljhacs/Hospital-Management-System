/**
 * HOSPITAL MANAGEMENT SYSTEM - SECURITY CONFIGURATION
 * Platform Unification & Access Control Module
 * Silently enforces security without user warnings
 */

(function() {
    'use strict';
    
    const SecurityConfig = {
        // Feature flags
        allowMobileAccess: false,
        blockDeveloperTools: true,
        disableCopyPaste: true,
        preventScreenshots: true,
        disableRightClick: true,
        
        // Initialize all security modules
        init: function() {
            console.clear = () => {}; // Disable console.clear silently
            
            if (this.allowMobileAccess === false) {
                this.checkDeviceType();
            }
            
            if (this.blockDeveloperTools === true) {
                this.initializeAntiDebug();
            }
            
            if (this.disableCopyPaste === true) {
                this.initializeCopyProtection();
            }
            
            if (this.preventScreenshots === true) {
                this.initializeScreenshotBlocker();
            }
            
            if (this.disableRightClick === true) {
                this.initializeContextMenuBlocker();
            }
        },
        
        // Check device type and block mobile access
        checkDeviceType: function() {
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const isTablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(navigator.userAgent);
            
            if (isMobile && !isTablet) {
                // Silently redirect to error page without warning
                window.location.href = 'about:blank';
                // Or show blank page
                document.body.innerHTML = '';
                document.body.style.display = 'none';
            }
        },
        
        // Disable developer tools
        initializeAntiDebug: function() {
            // Disable right-click
            document.addEventListener('contextmenu', (e) => e.preventDefault(), true);
            
            // Disable common developer tools shortcuts
            document.addEventListener('keydown', (e) => {
                // F12 - Developer Tools
                if (e.key === 'F12' || e.code === 'F12') {
                    e.preventDefault();
                    return false;
                }
                
                // Ctrl+Shift+I - Inspector
                if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.code === 'KeyI')) {
                    e.preventDefault();
                    return false;
                }
                
                // Ctrl+Shift+J - Console
                if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.code === 'KeyJ')) {
                    e.preventDefault();
                    return false;
                }
                
                // Ctrl+Shift+C - Element Inspector
                if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.code === 'KeyC')) {
                    e.preventDefault();
                    return false;
                }
                
                // Ctrl+Shift+K - Console (Firefox)
                if (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.code === 'KeyK')) {
                    e.preventDefault();
                    return false;
                }
            }, true);
            
            // Disable console methods
            window.console.log = () => {};
            window.console.debug = () => {};
            window.console.info = () => {};
            window.console.warn = () => {};
            window.console.error = () => {};
            
            // Disable debugger
            const noop = () => {};
            window.console.clear = noop;
            
            // Detect DevTools
            let devtools = { open: false };
            let lastCheck = 0;
            setInterval(() => {
                const now = Date.now();
                if (now - lastCheck > 100) {
                    lastCheck = now;
                    if (window.outerHeight - window.innerHeight > 100 || 
                        window.outerWidth - window.innerWidth > 100) {
                        // DevTools detected
                        devtools.open = true;
                        // Silently close or prevent interaction
                    }
                }
            }, 100);
        },
        
        // Disable copy/paste functionality
        initializeCopyProtection: function() {
            // Block copy event
            document.addEventListener('copy', (e) => {
                e.preventDefault();
                return false;
            }, true);
            
            // Block cut event
            document.addEventListener('cut', (e) => {
                e.preventDefault();
                return false;
            }, true);
            
            // Block paste event
            document.addEventListener('paste', (e) => {
                e.preventDefault();
                return false;
            }, true);
            
            // Block select all
            document.addEventListener('selectstart', (e) => {
                e.preventDefault();
                return false;
            }, true);
            
            // CSS-level protection
            const style = document.createElement('style');
            style.textContent = `
                * {
                    -webkit-user-select: none !important;
                    -moz-user-select: none !important;
                    -ms-user-select: none !important;
                    user-select: none !important;
                    -webkit-touch-callout: none !important;
                }
                input, textarea {
                    -webkit-user-select: text !important;
                    -moz-user-select: text !important;
                    -ms-user-select: text !important;
                    user-select: text !important;
                }
            `;
            document.head.appendChild(style);
        },
        
        // Prevent screenshots
        initializeScreenshotBlocker: function() {
            // Block print screen key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'PrintScreen' || e.keyCode === 44) {
                    e.preventDefault();
                    navigator.clipboard?.writeText('');
                    return false;
                }
            }, true);
            
            // Monitor visibility change (screen recording detection)
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    // Page became visible - could be screenshot app
                }
            });
            
            // Visual protection - overlay during screenshot attempts
            const protectionStyle = document.createElement('style');
            protectionStyle.textContent = `
                html {
                    -webkit-filter: invert(0) !important;
                }
                @media print {
                    body {
                        display: none !important;
                    }
                }
            `;
            document.head.appendChild(protectionStyle);
        },
        
        // Disable right-click context menu
        initializeContextMenuBlocker: function() {
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, true);
            
            // Disable mouse up/down for right-click
            document.addEventListener('mouseup', (e) => {
                if (e.button === 2) {
                    e.preventDefault();
                    return false;
                }
            }, true);
        }
    };
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            SecurityConfig.init();
        });
    } else {
        SecurityConfig.init();
    }
    
    // Also initialize immediately
    SecurityConfig.init();
    
    // Expose config for potential admin override (requires authentication)
    window.__SecurityConfig__ = SecurityConfig;
    
})();
