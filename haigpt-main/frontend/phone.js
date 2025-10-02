// ==================== MOBILE DETECTION & ENHANCEMENT ====================
(function() {
    'use strict';
    
    // Device detection utilities
    const DeviceDetector = {
        // Check if touch device
        isTouchDevice: () => {
            return ('ontouchstart' in window) || 
                   (navigator.maxTouchPoints > 0) || 
                   (navigator.msMaxTouchPoints > 0);
        },
        
        // Check if mobile device
        isMobile: () => {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase()) ||
                   (window.innerWidth <= 768 && DeviceDetector.isTouchDevice());
        },
        
        // Check if tablet
        isTablet: () => {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            return (/ipad|android|android 3.0|xoom|sch-i800|playbook|tablet|kindle/i.test(userAgent.toLowerCase()) &&
                   window.innerWidth > 480 && window.innerWidth <= 1024) ||
                   (window.innerWidth > 480 && window.innerWidth <= 1024 && DeviceDetector.isTouchDevice());
        },
        
        // Check if iOS
        isIOS: () => {
            return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        },
        
        // Check if Android
        isAndroid: () => {
            return /android/i.test(navigator.userAgent);
        },
        
        // Check if PWA/Standalone
        isStandalone: () => {
            return window.matchMedia('(display-mode: standalone)').matches ||
                   window.navigator.standalone ||
                   document.referrer.includes('android-app://');
        },
        
        // Get device type
        getDeviceType: () => {
            if (window.innerWidth <= 480) return 'mobile';
            if (window.innerWidth <= 768) return 'tablet';
            if (window.innerWidth <= 1024 && DeviceDetector.isTouchDevice()) return 'tablet';
            return 'desktop';
        },
        
        // Check if has notch (iPhone X+)
        hasNotch: () => {
            const ratio = window.devicePixelRatio || 1;
            const screen = window.screen;
            const hasNotch = DeviceDetector.isIOS() && ratio === 3 && 
                           ((screen.width === 375 && screen.height === 812) || // iPhone X, XS, 11 Pro
                            (screen.width === 414 && screen.height === 896) || // iPhone XR, XS Max, 11, 11 Pro Max
                            (screen.width === 390 && screen.height === 844) || // iPhone 12, 13, 14
                            (screen.width === 428 && screen.height === 926) || // iPhone 12, 13, 14 Pro Max
                            (screen.width === 393 && screen.height === 852) || // iPhone 14 Pro
                            (screen.width === 430 && screen.height === 932));  // iPhone 14 Pro Max
            return hasNotch;
        }
    };
    
    // Touch gesture handler
    const TouchHandler = {
        touchStartX: 0,
        touchStartY: 0,
        touchEndX: 0,
        touchEndY: 0,
        
        init: function() {
            if (!DeviceDetector.isTouchDevice()) return;
            
            // Add swipe listeners to body
            document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
            document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
            
            // Prevent pull-to-refresh on Chrome
            document.body.style.overscrollBehavior = 'none';
        },
        
        handleTouchStart: function(e) {
            this.touchStartX = e.changedTouches[0].screenX;
            this.touchStartY = e.changedTouches[0].screenY;
        },
        
        handleTouchEnd: function(e) {
            this.touchEndX = e.changedTouches[0].screenX;
            this.touchEndY = e.changedTouches[0].screenY;
            this.handleSwipe();
        },
        
        handleSwipe: function() {
            const swipeThreshold = 50;
            const verticalThreshold = 100;
            
            const deltaX = this.touchEndX - this.touchStartX;
            const deltaY = this.touchEndY - this.touchStartY;
            
            // Check if horizontal swipe
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > swipeThreshold) {
                    // Swipe right - open chat sidebar
                    const chatSidebar = document.querySelector('.chat-sidebar-menu');
                    const chatOverlay = document.querySelector('.chat-sidebar-overlay');
                    if (chatSidebar && !chatSidebar.classList.contains('open')) {
                        // Check if swipe started from left edge
                        if (this.touchStartX < 30) {
                            chatSidebar.classList.add('open');
                            chatOverlay?.classList.add('open');
                            document.body.classList.add('sidebar-open');
                            document.dispatchEvent(new CustomEvent('sidebarOpened', { detail: 'chat' }));
                        }
                    }
                } else if (deltaX < -swipeThreshold) {
                    // Swipe left - close any open sidebar
                    const chatSidebar = document.querySelector('.chat-sidebar-menu.open');
                    const codeSidebar = document.querySelector('.code-sidebar.open');
                    
                    if (chatSidebar) {
                        chatSidebar.classList.remove('open');
                        document.querySelector('.chat-sidebar-overlay')?.classList.remove('open');
                        document.body.classList.remove('sidebar-open');
                    }
                    if (codeSidebar) {
                        codeSidebar.classList.remove('open');
                        document.querySelector('.code-sidebar-overlay')?.classList.remove('open');
                    }
                }
            }
        }
    };
    
    // Virtual keyboard handler
    const KeyboardHandler = {
        isKeyboardOpen: false,
        originalHeight: window.innerHeight,
        
        init: function() {
            if (!DeviceDetector.isMobile()) return;
            
            // Use Visual Viewport API if available
            if ('visualViewport' in window) {
                window.visualViewport.addEventListener('resize', this.handleViewportResize.bind(this));
            } else {
                // Fallback for older browsers
                window.addEventListener('resize', this.handleResize.bind(this));
            }
            
            // Handle input focus/blur
            document.addEventListener('focusin', this.handleFocusIn.bind(this));
            document.addEventListener('focusout', this.handleFocusOut.bind(this));
        },
        
        handleViewportResize: function() {
            const currentHeight = window.visualViewport.height;
            const heightDiff = this.originalHeight - currentHeight;
            
            // Keyboard is likely open if height decreased significantly
            this.isKeyboardOpen = heightDiff > 100;
            
            if (this.isKeyboardOpen) {
                document.body.classList.add('keyboard-open');
                this.adjustForKeyboard();
            } else {
                document.body.classList.remove('keyboard-open');
                this.resetLayout();
            }
        },
        
        handleResize: function() {
            const currentHeight = window.innerHeight;
            const heightDiff = this.originalHeight - currentHeight;
            
            this.isKeyboardOpen = heightDiff > 100;
            
            if (this.isKeyboardOpen) {
                document.body.classList.add('keyboard-open');
            } else {
                document.body.classList.remove('keyboard-open');
                this.originalHeight = currentHeight;
            }
        },
        
        handleFocusIn: function(e) {
            if (e.target.matches('input, textarea')) {
                document.body.classList.add('input-focused');
                
                // Scroll input into view after keyboard opens
                setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            }
        },
        
        handleFocusOut: function(e) {
            if (e.target.matches('input, textarea')) {
                document.body.classList.remove('input-focused');
                
                // iOS fix: scroll to top to hide keyboard completely
                if (DeviceDetector.isIOS()) {
                    window.scrollTo(0, 0);
                }
            }
        },
        
        adjustForKeyboard: function() {
            // Scroll to bottom if in chat
            const messagesArea = document.querySelector('.messages-area');
            if (messagesArea) {
                const messagesEnd = messagesArea.querySelector('div[ref="messagesEndRef"]');
                if (messagesEnd) {
                    messagesEnd.scrollIntoView({ behavior: 'smooth' });
                }
            }
        },
        
        resetLayout: function() {
            // Reset any adjustments made for keyboard
            document.body.style.height = '';
        }
    };
    
    // Orientation handler
    const OrientationHandler = {
        init: function() {
            if (!DeviceDetector.isMobile()) return;
            
            // Initial orientation
            this.updateOrientation();
            
            // Listen for orientation changes
            window.addEventListener('orientationchange', this.updateOrientation.bind(this));
            window.addEventListener('resize', this.updateOrientation.bind(this));
        },
        
        updateOrientation: function() {
            const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
            document.body.setAttribute('data-orientation', orientation);
            
            // Add orientation class
            document.body.classList.remove('orientation-portrait', 'orientation-landscape');
            document.body.classList.add(`orientation-${orientation}`);
            
            // Trigger custom event
            document.dispatchEvent(new CustomEvent('orientationChanged', { detail: orientation }));
        },
        
        isLandscape: function() {
            return window.innerWidth > window.innerHeight;
        }
    };
    
    // Performance optimizations
    const PerformanceOptimizer = {
        init: function() {
            if (!DeviceDetector.isMobile()) return;
            
            // Reduce animations on low-end devices
            this.checkPerformance();
            
            // Optimize scroll performance
            this.optimizeScroll();
            
            // Lazy load images
            this.initLazyLoading();
        },
        
        checkPerformance: function() {
            // Check for reduced motion preference
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                document.body.classList.add('reduce-motion');
            }
            
            // Check device memory (if available)
            if ('deviceMemory' in navigator && navigator.deviceMemory < 4) {
                document.body.classList.add('low-memory');
            }
            
            // Check connection speed
            if ('connection' in navigator) {
                const connection = navigator.connection;
                if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') {
                    document.body.classList.add('slow-connection');
                }
            }
        },
        
        optimizeScroll: function() {
            // Add passive listeners for better scroll performance
            const scrollElements = document.querySelectorAll('.messages-area, .chat-list, .code-sidebar-content');
            scrollElements.forEach(el => {
                el.addEventListener('scroll', () => {}, { passive: true });
            });
            
            // Use CSS containment
            scrollElements.forEach(el => {
                el.style.contain = 'layout style paint';
            });
        },
        
        initLazyLoading: function() {
            if ('IntersectionObserver' in window) {
                const images = document.querySelectorAll('img[data-src]');
                const imageObserver = new IntersectionObserver((entries, observer) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            imageObserver.unobserve(img);
                        }
                    });
                });
                
                images.forEach(img => imageObserver.observe(img));
            }
        }
    };
    
    // Mobile UI Enhancer - Add user info to sidebar
    const MobileUIEnhancer = {
        init: function() {
            if (!DeviceDetector.isMobile()) return;
            
            // Move user info to sidebar on mobile
            this.moveUserInfoToSidebar();
            
            // Add logout/profile buttons to sidebar
            this.enhanceSidebar();
        },
        
        moveUserInfoToSidebar: function() {
            // This will be handled by React component
            // Just add a class to indicate mobile mode
            document.body.classList.add('mobile-sidebar-enhanced');
        },
        
        enhanceSidebar: function() {
            // Add event listener for hamburger menu
            const hamburger = document.querySelector('.hamburger-menu');
            if (hamburger) {
                hamburger.addEventListener('click', () => {
                    document.body.classList.toggle('sidebar-open');
                });
            }
        }
    };
    
    // Initialize everything
    const MobileEnhancer = {
        init: function() {
            // Detect device type
            const deviceType = DeviceDetector.getDeviceType();
            const isMobile = DeviceDetector.isMobile();
            const isTablet = DeviceDetector.isTablet();
            const hasNotch = DeviceDetector.hasNotch();
            
            // Add classes to body
            document.body.classList.add(`device-${deviceType}`);
            if (isMobile) document.body.classList.add('is-mobile');
            if (isTablet) document.body.classList.add('is-tablet');
            if (DeviceDetector.isTouchDevice()) document.body.classList.add('touch-device');
            if (DeviceDetector.isIOS()) document.body.classList.add('ios-device');
            if (DeviceDetector.isAndroid()) document.body.classList.add('android-device');
            if (DeviceDetector.isStandalone()) document.body.classList.add('standalone-app');
            if (hasNotch) document.body.classList.add('has-notch');
            
            // Initialize handlers
            TouchHandler.init();
            KeyboardHandler.init();
            OrientationHandler.init();
            PerformanceOptimizer.init();
            MobileUIEnhancer.init();
            
            // Add viewport meta if missing
            this.ensureViewportMeta();
            
            // Log device info
            console.log('📱 Mobile Enhancer Initialized:', {
                deviceType,
                isMobile,
                isTablet,
                hasNotch,
                touchDevice: DeviceDetector.isTouchDevice(),
                screenSize: `${window.innerWidth}x${window.innerHeight}`,
                pixelRatio: window.devicePixelRatio
            });
        },
        
        ensureViewportMeta: function() {
            let viewport = document.querySelector('meta[name="viewport"]');
            if (!viewport) {
                viewport = document.createElement('meta');
                viewport.name = 'viewport';
                viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
                document.head.appendChild(viewport);
            } else {
                // Ensure viewport-fit=cover for notch support
                if (!viewport.content.includes('viewport-fit=cover')) {
                    viewport.content += ', viewport-fit=cover';
                }
            }
        }
    };
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => MobileEnhancer.init());
    } else {
        MobileEnhancer.init();
    }
    
    // Export for use in other scripts
    window.MobileUtils = {
        DeviceDetector,
        TouchHandler,
        KeyboardHandler,
        OrientationHandler,
        PerformanceOptimizer,
        MobileUIEnhancer
    };
})();