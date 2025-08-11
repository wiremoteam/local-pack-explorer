/**
 * Google Search Console Context Menu Extension
 * Integrates with Chrome's native context menu for copying keywords
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        SELECTOR_KEYWORD_ROWS: 'tr[data-row-key], .keyword-row, [role="row"]',
        SELECTOR_KEYWORD_CELL: 'td:first-child, .keyword-cell, [data-testid="keyword"]',
        HIGHLIGHT_CLASS: 'gsc-context-highlight',
        ANIMATION_DURATION: 200
    };

    // State management
    let currentHighlightedRow = null;
    let lastRightClickTime = 0;
    let isRebuildingMenu = false; // Flag to prevent infinite loops

    /**
     * Initialize the extension
     */
    function init() {
        console.log('[GSC Context Menu] Initializing...');
        
        // Add event listeners
        document.addEventListener('contextmenu', handleContextMenu, true);
        document.addEventListener('click', handleClickOutside);
        
        // Add styles for highlighting
        addStyles();
        
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener(handleMessage);
        
        console.log('[GSC Context Menu] Initialized successfully');
    }

    /**
     * Add custom styles for highlighting
     */
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .${CONFIG.HIGHLIGHT_CLASS} {
                background-color: #e3f2fd !important;
                border: 2px solid #2196f3 !important;
                transition: all ${CONFIG.ANIMATION_DURATION}ms ease-in-out;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Handle right-click context menu
     */
    function handleContextMenu(event) {
        // Prevent infinite loops during menu rebuild
        if (isRebuildingMenu) {
            return;
        }
        
        const target = event.target;
        const row = findKeywordRow(target);
        
        if (row) {
            // Get keyword from the row
            const keyword = extractKeywordFromRow(row);
            
            if (keyword) {
                // Store timestamp to prevent double processing
                lastRightClickTime = Date.now();
                
                // Clean up previous highlight before highlighting new row
                // This handles the case when user moves mouse to another keyword
                removeHighlight();
                
                // Highlight the row
                highlightRow(row);
                
                // Send message to background script to update context menu
                chrome.runtime.sendMessage({
                    action: 'keyword-detected',
                    keyword: keyword
                }).then(response => {
                    if (response && response.success) {
                        console.log('[GSC Context Menu] Keyword detected:', keyword);
                        
                        // Force menu rebuild by triggering a new context menu event
                        // This ensures the menu is rebuilt with the updated keyword
                        setTimeout(() => {
                            isRebuildingMenu = true; // Set flag to prevent infinite loops
                            
                            const newEvent = new MouseEvent('contextmenu', {
                                bubbles: true,
                                cancelable: true,
                                view: window,
                                button: 2,
                                buttons: 2,
                                clientX: event.clientX,
                                clientY: event.clientY,
                                screenX: event.screenX,
                                screenY: event.screenY
                            });
                            
                            // Dispatch the new event to force menu rebuild
                            target.dispatchEvent(newEvent);
                            
                            // Reset flag after a short delay
                            setTimeout(() => {
                                isRebuildingMenu = false;
                            }, 200);
                        }, 50); // Small delay to ensure background script has processed
                    }
                }).catch(error => {
                    console.error('[GSC Context Menu] Failed to send keyword:', error);
                });
            }
        } else {
            // Remove highlight if clicking outside keyword rows
            removeHighlight();
        }
    }

    /**
     * Find the keyword row containing the clicked element
     */
    function findKeywordRow(element) {
        let current = element;
        
        while (current && current !== document.body) {
            // Check if current element is a keyword row
            if (isKeywordRow(current)) {
                return current;
            }
            
            // Check if current element contains keyword data
            if (current.querySelector && current.querySelector(CONFIG.SELECTOR_KEYWORD_CELL)) {
                return current;
            }
            
            current = current.parentElement;
        }
        
        return null;
    }

    /**
     * Check if element is a keyword row
     */
    function isKeywordRow(element) {
        if (!element || !element.matches) return false;
        
        // Check various selectors for keyword rows
        return element.matches(CONFIG.SELECTOR_KEYWORD_ROWS) ||
               element.hasAttribute('data-row-key') ||
               element.classList.contains('keyword-row') ||
               element.getAttribute('role') === 'row';
    }

    /**
     * Extract keyword text from a row
     */
    function extractKeywordFromRow(row) {
        // Try multiple selectors to find the keyword
        const selectors = [
            CONFIG.SELECTOR_KEYWORD_CELL,
            'td:first-child',
            '.keyword-cell',
            '[data-testid="keyword"]',
            '.keyword-text',
            'td'
        ];
        
        for (const selector of selectors) {
            const element = row.querySelector(selector);
            if (element) {
                const text = element.textContent?.trim();
                if (text && text.length > 0 && text.length < 100) {
                    return text;
                }
            }
        }
        
        // Fallback: try to get text from the first cell
        const firstCell = row.querySelector('td, th');
        if (firstCell) {
            const text = firstCell.textContent?.trim();
            if (text && text.length > 0 && text.length < 100) {
                return text;
            }
        }
        
        return null;
    }

    /**
     * Highlight the selected row
     */
    function highlightRow(row) {
        removeHighlight();
        
        row.classList.add(CONFIG.HIGHLIGHT_CLASS);
        currentHighlightedRow = row;
    }

    /**
     * Remove highlight from previously highlighted row
     */
    function removeHighlight() {
        if (currentHighlightedRow) {
            currentHighlightedRow.classList.remove(CONFIG.HIGHLIGHT_CLASS);
            currentHighlightedRow = null;
        }
    }

    /**
     * Handle clicks outside the context menu
     */
    function handleClickOutside(event) {
        // Remove highlight after a short delay to allow context menu to appear
        setTimeout(() => {
            removeHighlight();
        }, 100);
    }

    /**
     * Handle messages from background script
     */
    function handleMessage(request, sender, sendResponse) {
        if (request.action === 'keyword-copied') {
            // Remove highlight when keyword is copied
            removeHighlight();
            
            // Send confirmation back to background script
            chrome.runtime.sendMessage({
                action: 'keyword-copied',
                keyword: request.keyword
            }).catch(() => {
                // Background script might not be listening, which is fine
            });
            
            console.log('[GSC Context Menu] Keyword copied:', request.keyword);
        }
    }

    /**
     * Cleanup function
     */
    function cleanup() {
        document.removeEventListener('contextmenu', handleContextMenu, true);
        document.removeEventListener('click', handleClickOutside);
        removeHighlight();
        isRebuildingMenu = false; // Reset rebuilding flag
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

    // Export for debugging
    window.GSCContextMenu = {
        init,
        cleanup,
        highlightRow,
        removeHighlight,
        extractKeywordFromRow,
        isRebuildingMenu: () => isRebuildingMenu
    };

})();
