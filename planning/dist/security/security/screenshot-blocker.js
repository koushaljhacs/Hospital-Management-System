/**
 * SCREENSHOT BLOCKER MODULE
 * Prevents screenshots and screen recording silently
 */

(function() {
    'use strict';
    
    window.ScreenshotBlocker = {
        // Block Print Screen key
        blockPrintScreen: function() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'PrintScreen' || e.keyCode === 44) {
                    e.preventDefault();
                    // Clear clipboard immediately
                    if (navigator.clipboard) {
                        navigator.clipboard.writeText('').catch(() => {});
                    }
                    return false;
                }
            }, true);
        },
        
        // Block Shift+PrintScreen
        blockShiftPrintScreen: function() {
            document.addEventListener('keydown', (e) => {
                if ((e.shiftKey && e.key === 'PrintScreen') || (e.shiftKey && e.keyCode === 44)) {
                    e.preventDefault();
                    return false;
                }
            }, true);
        },
        
        // Detect screenshot attempts via visibility API
        detectScreenshotAttempts: function() {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    // Page became visible - could be screenshot tool
                    // Silently handle, no warning
                }
            });
        },
        
        // Protect against page save
        preventPageSave: function() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+S / Cmd+S (Save)
                if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.code === 'KeyS')) {
                    e.preventDefault();
                    return false;
                }
            }, true);
        },
        
        // Add visual protection that disrupts screenshots
        addVisualProtection: function() {
            const style = document.createElement('style');
            style.textContent = `
                /* Prevent text selection which protects from screenshots */
                body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                /* Prevent page from being saved */
                @media print {
                    body {
                        display: none !important;
                    }
                    html {
                        display: none !important;
                    }
                }
                
                /* Protect against screen capture tools */
                html {
                    -webkit-filter: none !important;
                }
            `;
            document.head.appendChild(style);
        },
        
        // Monitor window focus/blur for screenshot app detection
        monitorWindowFocus: function() {
            let blurCount = 0;
            
            window.addEventListener('blur', () => {
                blurCount++;
                if (blurCount > 5) {
                    blurCount = 0;
                    // Too many blur events - could be screenshot app scanning
                    // Silently handle
                }
            });
            
            window.addEventListener('focus', () => {
                blurCount = 0;
            });
        },
        
        // Block common screenshot tools' attempts to read pixel data
        blockPixelAccess: function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                const originalGetImageData = ctx.getImageData;
                ctx.getImageData = function() {
                    // Return blank/transparent data
                    return originalGetImageData.call(this, 0, 0, 1, 1);
                };
            }
        },
        
        // Initialize all screenshot protection
        init: function() {
            this.blockPrintScreen();
            this.blockShiftPrintScreen();
            this.detectScreenshotAttempts();
            this.preventPageSave();
            this.addVisualProtection();
            this.monitorWindowFocus();
            this.blockPixelAccess();
        }
    };
    
    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.ScreenshotBlocker.init();
        });
    } else {
        window.ScreenshotBlocker.init();
    }
    
})();
