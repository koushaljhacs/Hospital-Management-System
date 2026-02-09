/**
 * DEVICE TYPE CHECKER
 * Silently blocks mobile devices, allows desktop and tablets
 */

(function() {
    'use strict';
    
    window.DeviceChecker = {
        // Check if device is mobile (not tablet)
        isMobileDevice: function() {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            
            // Check for mobile devices
            const mobileRegex = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;
            const tabletRegex = /iPad|Android(?!.*Mobile)|Tablet|Nexus 7|Nexus 10|KFAPWI|SM-T|WindowsPhone/i;
            
            const isMobile = mobileRegex.test(userAgent);
            const isTablet = tabletRegex.test(userAgent);
            
            // Return true only if it's mobile but NOT tablet
            return isMobile && !isTablet;
        },
        
        // Check if device is desktop or tablet
        isDesktopOrTablet: function() {
            return !this.isMobileDevice();
        },
        
        // Get device type
        getDeviceType: function() {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            
            if (/iPad|Android(?!.*Mobile)|Tablet|Nexus 7|Nexus 10/i.test(userAgent)) {
                return 'tablet';
            } else if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
                return 'mobile';
            } else {
                return 'desktop';
            }
        },
        
        // Block mobile access silently
        blockMobileAccess: function() {
            if (this.isMobileDevice()) {
                // Clear everything silently
                document.body.innerHTML = '';
                document.documentElement.innerHTML = '';
                window.location.href = 'about:blank';
            }
        },
        
        // Initialize
        init: function() {
            this.blockMobileAccess();
        }
    };
    
    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.DeviceChecker.init();
        });
    } else {
        window.DeviceChecker.init();
    }
    
})();
