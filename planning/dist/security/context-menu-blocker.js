/**
 * CONTEXT MENU BLOCKER MODULE
 * Disables right-click context menu silently
 */

(function() {
    'use strict';
    
    window.ContextMenuBlocker = {
        // Block context menu
        blockContextMenu: function() {
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }, true);
        },
        
        // Block mouse right button
        blockMouseRightButton: function() {
            document.addEventListener('mouseup', (e) => {
                if (e.button === 2) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }, true);
            
            document.addEventListener('mousedown', (e) => {
                if (e.button === 2) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }, true);
        },
        
        // Block touch context menu (long press)
        blockTouchContextMenu: function() {
            document.addEventListener('touchstart', (e) => {
                if (e.touches.length > 1) {
                    e.preventDefault();
                }
            }, true);
            
            document.addEventListener('touchend', (e) => {
                if (e.changedTouches.length > 1) {
                    e.preventDefault();
                }
            }, true);
        },
        
        // Disable inspect element for all elements
        disableInspect: function() {
            document.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    return false;
                }
            }, true);
        },
        
        // Initialize all context menu blocking
        init: function() {
            this.blockContextMenu();
            this.blockMouseRightButton();
            this.blockTouchContextMenu();
            this.disableInspect();
        }
    };
    
    // Auto-initialize
    window.ContextMenuBlocker.init();
    
})();
