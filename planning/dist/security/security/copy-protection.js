/**
 * COPY/PASTE PROTECTION MODULE
 * Silently prevents copy, cut, paste operations
 */

(function() {
    'use strict';
    
    window.CopyProtection = {
        // Block copy operation
        blockCopy: function() {
            document.addEventListener('copy', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, true);
        },
        
        // Block cut operation
        blockCut: function() {
            document.addEventListener('cut', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, true);
        },
        
        // Block paste operation
        blockPaste: function() {
            document.addEventListener('paste', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, true);
        },
        
        // Block text selection
        blockSelection: function() {
            document.addEventListener('selectstart', (e) => {
                e.preventDefault();
                return false;
            }, true);
            
            document.addEventListener('mousedown', (e) => {
                if (e.detail > 1) {
                    e.preventDefault();
                    return false;
                }
            }, true);
        },
        
        // Apply CSS-level protection
        applyCSSProtection: function() {
            const style = document.createElement('style');
            style.textContent = `
                * {
                    -webkit-user-select: none !important;
                    -moz-user-select: none !important;
                    -ms-user-select: none !important;
                    user-select: none !important;
                    -webkit-touch-callout: none !important;
                    -webkit-user-drag: none !important;
                }
                input, textarea {
                    -webkit-user-select: text !important;
                    -moz-user-select: text !important;
                    -ms-user-select: text !important;
                    user-select: text !important;
                }
                img {
                    pointer-events: none !important;
                    -webkit-user-drag: none !important;
                }
            `;
            document.head.appendChild(style);
        },
        
        // Disable drag and drop
        blockDragDrop: function() {
            document.addEventListener('drag', (e) => {
                e.preventDefault();
                return false;
            }, true);
            
            document.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }, true);
            
            document.addEventListener('dragover', (e) => {
                e.preventDefault();
                return false;
            }, true);
        },
        
        // Block keyboard shortcuts for copy/paste
        blockKeyboardShortcuts: function() {
            document.addEventListener('keydown', (e) => {
                // Ctrl+C / Cmd+C (Copy)
                if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.code === 'KeyC')) {
                    e.preventDefault();
                    return false;
                }
                
                // Ctrl+X / Cmd+X (Cut)
                if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.code === 'KeyX')) {
                    e.preventDefault();
                    return false;
                }
                
                // Ctrl+V / Cmd+V (Paste)
                if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.code === 'KeyV')) {
                    e.preventDefault();
                    return false;
                }
                
                // Ctrl+A / Cmd+A (Select All)
                if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.code === 'KeyA')) {
                    e.preventDefault();
                    return false;
                }
            }, true);
        },
        
        // Initialize all copy protection
        init: function() {
            this.blockCopy();
            this.blockCut();
            this.blockPaste();
            this.blockSelection();
            this.applyCSSProtection();
            this.blockDragDrop();
            this.blockKeyboardShortcuts();
        }
    };
    
    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.CopyProtection.init();
        });
    } else {
        window.CopyProtection.init();
    }
    
})();
