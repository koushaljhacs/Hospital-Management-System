/**
 * ANTI-DEBUG MODULE
 * Disables developer tools without warnings
 */

(function() {
    'use strict';
    
    window.AntiDebug = {
        // Disable all developer shortcuts
        disableDeveloperShortcuts: function() {
            document.addEventListener('keydown', (e) => {
                // Prevent F12
                if (e.key === 'F12' || e.code === 'F12') {
                    e.preventDefault();
                    return false;
                }
                
                // Prevent Ctrl+Shift+I (Inspector)
                if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.code === 'KeyI')) {
                    e.preventDefault();
                    return false;
                }
                
                // Prevent Ctrl+Shift+J (Console)
                if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.code === 'KeyJ')) {
                    e.preventDefault();
                    return false;
                }
                
                // Prevent Ctrl+Shift+C (Element Inspector)
                if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.code === 'KeyC')) {
                    e.preventDefault();
                    return false;
                }
                
                // Prevent Ctrl+Shift+K (Console Firefox)
                if (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.code === 'KeyK')) {
                    e.preventDefault();
                    return false;
                }
                
                // Prevent Ctrl+Shift+M (Responsive Design)
                if (e.ctrlKey && e.shiftKey && (e.key === 'M' || e.code === 'KeyM')) {
                    e.preventDefault();
                    return false;
                }
            }, true);
        },
        
        // Disable console methods
        disableConsole: function() {
            const noop = () => {};
            window.console = {
                log: noop,
                debug: noop,
                info: noop,
                warn: noop,
                error: noop,
                clear: noop,
                time: noop,
                timeEnd: noop,
                trace: noop,
                group: noop,
                groupEnd: noop,
                assert: noop,
                profile: noop,
                profileEnd: noop
            };
        },
        
        // Disable right-click
        disableRightClick: function() {
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, true);
        },
        
        // Detect and handle DevTools
        detectDevTools: function() {
            let check = setInterval(() => {
                if (window.outerHeight - window.innerHeight > 150 || 
                    window.outerWidth - window.innerWidth > 150) {
                    // DevTools detected - silently handle
                    // Don't do anything visible, just track
                }
            }, 100);
        },
        
        // Initialize all anti-debug features
        init: function() {
            this.disableDeveloperShortcuts();
            this.disableConsole();
            this.disableRightClick();
            this.detectDevTools();
        }
    };
    
    // Auto-initialize
    window.AntiDebug.init();
    
})();
