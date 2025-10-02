(function() {
    'use strict';
    
    const blockContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    };
    
    ['contextmenu', 'auxclick'].forEach(eventType => {
        document.addEventListener(eventType, blockContextMenu, true);
        window.addEventListener(eventType, blockContextMenu, true);
        document.documentElement.addEventListener(eventType, blockContextMenu, true);
    });
    
    document.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
    }, true);
    
    Object.defineProperty(document, 'oncontextmenu', {
        value: null,
        writable: false,
        configurable: false
    });
    
    setInterval(() => {
        document.oncontextmenu = null;
        window.oncontextmenu = null;
        if (document.body) document.body.oncontextmenu = null;
    }, 100);

    document.addEventListener('keydown', (e) => {
        if (e.keyCode === 123) {
            e.preventDefault();
            return false;
        }
        
        if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) {
            e.preventDefault();
            return false;
        }
        
        if (e.ctrlKey && e.keyCode === 85) {
            e.preventDefault();
            return false;
        }
        
        if ((e.ctrlKey || e.metaKey) && e.altKey && (e.keyCode === 73 || e.keyCode === 74)) {
            e.preventDefault();
            return false;
        }
    }, true);
})();