// content.js
//console.log('content.js is running。。。')

// Global flag to prevent multiple initializations
if (window.serpCounterInitialized) {
    // console.log('[SERP Counter] Already initialized, skipping');
} else {
    window.serpCounterInitialized = true;
    // console.log('[SERP Counter] Initializing...');

    // Vanilla JavaScript QueryString function
    function getQueryString(name) {
        const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
        const r = window.location.search.substr(1).match(reg);
        if (r != null) return unescape(r[2]); 
        return null;
    }

    // Check if current page is a Google search page
    function isGoogleSearchPage() {
        const currentUrl = window.location.href;
        return currentUrl.startsWith('https://www.google.com/search');
    }

    // Get current search type
    function getCurrentSearchType() {
        const udm = getQueryString("udm");
        if (!udm) return "All";
        
        const typeMap = {
            "2": "Images"
        };
        
        return typeMap[udm] || "All";
    }

    var renderCounterHtml = function() {
        // First check if we're on a Google search page
        if (!isGoogleSearchPage()) {
            // console.log('[SERP Counter] Not a Google search page, skipping');
            return;
        }
        
        // Check if SERP numbering is enabled
        chrome.storage.sync.get({
            serpNumberingEnabled: true
        }, function(settings) {
            if (!settings.serpNumberingEnabled) {
                // console.log('[SERP Counter] SERP numbering is disabled, skipping');
                return;
            }
            
            // Check if current search type should be excluded
            const currentType = getCurrentSearchType();
            if (currentType === "Images") {
                // console.log('[SERP Counter] Images search detected, skipping numbering');
                return;
            }
            
            // Number organic SERP results
            numberOrganicResults();
            
            // Number Google ads separately
            numberGoogleAds();
        });
    };

    // Function to number organic SERP results
    function numberOrganicResults() {
        // Remove existing counters first
        document.querySelectorAll('.gtrack-counter').forEach(el => el.remove());
        
        // Use vanilla JavaScript instead of jQuery
        const headings = document.querySelectorAll("h3[class]:not(table h3):not(ul h3):not(li h3):not(title-with-lhs-icon h3):not(div.related-question-pair h3):not(g-section-with-header h3)");
        
        // console.log('[SERP Counter] Found headings:', headings.length);
        // console.log('[SERP Counter] Current URL:', window.location.href);
        
        let actualCounter = 0; // Separate counter for actual results
        
        headings.forEach(function(heading, index) {
            // console.log('[SERP Counter] Processing heading', index, 'Text:', heading.textContent.trim().substring(0, 50));
            
            // Skip navigation elements like "Refine results"
            const headingText = heading.textContent.trim().toLowerCase();
            // console.log('[SERP Counter] Heading text (lowercase):', headingText);
            
            // Only skip actual navigation elements, not search results
            if (headingText === 'refine results' || headingText === 'map') {
                // console.log('[SERP Counter] Skipping navigation element:', headingText);
                return;
            }
            
            actualCounter++; // Only increment for actual results
            // console.log('[SERP Counter] Using counter:', actualCounter, 'for heading');
            
            // Check if counter already exists
            if (heading.querySelector(".gtrack-counter") === null) {
                var counterSpan = document.createElement("span");
                counterSpan.className = "gtrack-counter";
                counterSpan.textContent = actualCounter;
                heading.insertBefore(counterSpan, heading.firstChild);
                // console.log('[SERP Counter] Added counter:', actualCounter, 'to heading');
            } else {
                // console.log('[SERP Counter] Counter already exists for heading', index);
            }
        });
    }

    // Function to detect and number Google ads
    function numberGoogleAds() {
        // Remove existing ad counters first
        document.querySelectorAll('.gtrack-ad-counter-badge').forEach(el => el.remove());
        
        // Ads should have their own counter that starts from 1 on each page
        // Don't use the start parameter for ads - they should reset on each page
        
        // Use the same logic as SERP results - find ad headings
        const adHeadings = document.querySelectorAll('[data-text-ad] [role="heading"][aria-level="3"]:not(table [role="heading"]):not(ul [role="heading"]):not(li [role="heading"]):not(title-with-lhs-icon [role="heading"]):not(div.related-question-pair [role="heading"]):not(g-section-with-header [role="heading"])');
        
        // console.log('[Ad Counter] Found ad headings:', adHeadings.length);
        // console.log('[Ad Counter] Current URL:', window.location.href);
        
        adHeadings.forEach(function(heading, index) {
            var adCounter = index + 1; // Always start from 1 on each page
            // console.log('[Ad Counter] Processing ad heading', index, 'with counter:', adCounter, 'Text:', heading.textContent.trim().substring(0, 50));
            
            // Check if counter already exists
            if (heading.querySelector(".gtrack-ad-counter-badge") === null) {
                // Verify it's actually an ad by checking for "Sponsored" text in parent container
                const adContainer = heading.closest('[data-text-ad]');
                const sponsoredElement = adContainer.querySelector('.U3A9Ac, .qV8iec');
                const hasSponsoredText = sponsoredElement && sponsoredElement.textContent.toLowerCase().includes('sponsored');
                
                if (hasSponsoredText) {
                    var adBadge = document.createElement("span");
                    adBadge.className = "gtrack-ad-counter-badge";
                    adBadge.textContent = adCounter;
                    heading.insertBefore(adBadge, heading.firstChild);
                    // console.log('[Ad Counter] Added counter:', adCounter, 'to ad heading');
                } else {
                    // console.log('[Ad Counter] Skipped - no sponsored text found');
                }
            } else {
                // console.log('[Ad Counter] Counter already exists for ad heading', index);
            }
        });
    }

    // Show search result count - REMOVED (no longer needed)
    var showSearchResultCount = function() {
        // Function removed - no longer needed
        return;
    };

    // Listen for storage changes
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'sync') {
            // Check if SERP numbering setting changed
            if (changes.serpNumberingEnabled) {
                // console.log('[SERP Counter] SERP numbering setting changed:', changes.serpNumberingEnabled.newValue);
                if (changes.serpNumberingEnabled.newValue) {
                    // Setting enabled - run numbering
                    renderCounterHtml();
                } else {
                    // Setting disabled - remove all counters
                    // console.log('[SERP Counter] Removing all counters - setting disabled');
                    document.querySelectorAll('.gtrack-counter').forEach(el => el.remove());
                    document.querySelectorAll('.gtrack-ad-counter-badge').forEach(el => el.remove());
                }
            }
            
            // Check if show total results changed - REMOVED (no longer needed)
            // if (changes.showTotalResults) {
            //     showSearchResultCount();
            // }
        }
    });

    // Initialize only once - no storage change listeners to avoid duplicates
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            renderCounterHtml();
            // showSearchResultCount(); // REMOVED - no longer needed
            initWebsiteHighlighting(); // Initialize website highlighting
        });
    } else {
        renderCounterHtml();
        // showSearchResultCount(); // REMOVED - no longer needed
        initWebsiteHighlighting(); // Initialize website highlighting
    }

    // Cleanup function for website highlighting
    function cleanupWebsiteHighlighting() {
        if (applyHighlightsTimeout) {
            clearTimeout(applyHighlightsTimeout);
        }
        if (window.websiteHighlightObserver) {
            window.websiteHighlightObserver.disconnect();
        }
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanupWebsiteHighlighting);

    // ===== WEBSITE HIGHLIGHTING FUNCTIONALITY =====
    
    // State for highlighted domains
    let highlightedDomains = new Set();
    let applyHighlightsTimeout = null; // For debouncing
    let isApplyingHighlights = false; // Prevent concurrent applications
    
    /**
     * Initialize website highlighting functionality
     */
    function initWebsiteHighlighting() {
        // Load highlighted domains from storage
        loadHighlightedDomains();
        
        // Add context menu event listener
        document.addEventListener('contextmenu', handleWebsiteContextMenu, true);
        
        // Test if background script is responding (silent)
        chrome.runtime.sendMessage({
            action: 'test-background-connection'
        }).catch(error => {
            // Silent error handling
        });
        
        // Apply highlights with a delay to ensure content is loaded
        setTimeout(() => {
            applyHighlights();
        }, 1000);
        
        // Set up MutationObserver to handle dynamic content changes
        const observer = new MutationObserver(function(mutations) {
            // Skip if no domains to highlight
            if (highlightedDomains.size === 0) {
                return;
            }
            
            let shouldApplyHighlights = false;
            
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if new search results were added
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) { // Element node
                            if (node.matches && (
                                node.matches('[data-hveid]') ||
                                node.matches('.g') ||
                                node.matches('[jscontroller]') ||
                                node.querySelector('[data-hveid]') ||
                                node.querySelector('.g') ||
                                node.querySelector('[jscontroller]')
                            )) {
                                shouldApplyHighlights = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldApplyHighlights) {
                // Debounce the highlighting to prevent multiple rapid calls
                if (applyHighlightsTimeout) {
                    clearTimeout(applyHighlightsTimeout);
                }
                
                applyHighlightsTimeout = setTimeout(() => {
                    applyHighlights();
                }, 500); // Increased delay to prevent rapid firing
            }
        });
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Store observer reference for cleanup
        window.websiteHighlightObserver = observer;
        
        // Listen for storage changes
        chrome.storage.onChanged.addListener(function(changes, namespace) {
            if (namespace === 'sync' && changes.highlightedDomains) {
                // Debounce storage change handling
                if (applyHighlightsTimeout) {
                    clearTimeout(applyHighlightsTimeout);
                }
                
                applyHighlightsTimeout = setTimeout(() => {
                    loadHighlightedDomains();
                }, 100);
            }
        });
    }
    
    /**
     * Load highlighted domains from Chrome storage
     */
    function loadHighlightedDomains() {
        chrome.storage.sync.get(['highlightedDomains'], function(result) {
            const newDomains = new Set(Object.keys(result.highlightedDomains || {}));
    
            
            // Only apply highlights if domains actually changed or if we have domains to highlight
            const domainsChanged = newDomains.size !== highlightedDomains.size || 
                                 !Array.from(newDomains).every(domain => highlightedDomains.has(domain));
            
            highlightedDomains = newDomains;
            
            // Only apply highlights if domains changed or if we have domains to highlight
            if (domainsChanged || highlightedDomains.size > 0) {
                applyHighlights();
            }
        });
    }
    
    /**
     * Handle right-click context menu for website highlighting
     */
    function handleWebsiteContextMenu(event) {
        const target = event.target;

        
        const resultContainer = findSearchResultContainer(target);
        
        if (resultContainer) {
  
            
            try {
                const domain = extractDomainFromResult(resultContainer);
                if (domain) {
      
                    
                    // Store the domain for context menu action
                    window.currentHighlightDomain = domain;
                    
                    // Send message to background script to show context menu
                    // Use the same simple approach as Search Console
  
                    
                    chrome.runtime.sendMessage({
                        action: 'website-domain-detected',
                        domain: domain
                    }).then(response => {
  
                        if (response && response.success) {
                            
                        }
                    }).catch(error => {
                        // Handle extension context invalidated error gracefully
                        if (error.message && error.message.includes('Extension context invalidated')) {
                            console.warn('[Website Highlight] Extension context invalidated. This often happens on page reload or extension update. Ignoring.');
                        } else {
                            console.error('[Website Highlight] Error sending message:', error);
                        }
                    });
                } else {
      
                }
            } catch (error) {
                console.error('[Website Highlight] Error extracting domain:', error);
                // Continue execution without crashing
            }
        } else {
  
        }
    }
    
    /**
     * Find the search result container for a clicked element
     */
    function findSearchResultContainer(element) {
        let current = element;
        
        while (current && current !== document.body) {
            // Look for common search result container selectors
            if (current.matches && (
                current.matches('[data-hveid]') ||
                current.matches('.g') ||
                current.matches('[jscontroller]') ||
                current.matches('.rc') ||
                current.matches('.tF2Cxc') ||
                current.matches('[data-ved]') ||
                current.closest('[data-hveid]') ||
                current.closest('.g') ||
                current.closest('[jscontroller]') ||
                current.closest('.rc') ||
                current.closest('.tF2Cxc') ||
                current.closest('[data-ved]')
            )) {
                // Return the closest search result container
                return current.closest('[data-hveid]') || 
                       current.closest('.g') || 
                       current.closest('[jscontroller]') ||
                       current.closest('.rc') ||
                       current.closest('.tF2Cxc') ||
                       current.closest('[data-ved]') ||
                       current;
            }
            
            current = current.parentElement;
        }
        
        return null;
    }
    
    /**
     * Extract domain from a search result container
     */
    function extractDomainFromResult(container) {
        try {
            // First, check if this is an ad by looking for data-dtld attribute
            const adDomainElement = container.querySelector('[data-dtld]');
            if (adDomainElement) {
                const adDomain = adDomainElement.getAttribute('data-dtld');
                if (adDomain && adDomain.includes('.')) {
                    return adDomain;
                }
            }
            
            // Check for data-rw attribute (redirect URL for ads)
            const adRedirectLink = container.querySelector('a[data-rw]');
            if (adRedirectLink) {
                const redirectUrl = adRedirectLink.getAttribute('data-rw');
                if (redirectUrl && redirectUrl.startsWith('http')) {
                    try {
                        const url = new URL(redirectUrl);
                        const hostname = url.hostname;
                        
                        if (hostname && 
                            !hostname.includes('google.com') && 
                            !hostname.includes('googleusercontent.com') &&
                            !hostname.includes('gstatic.com') &&
                            hostname.length > 0 &&
                            hostname.includes('.')) {
                            return hostname;
                        }
                    } catch (e) {
                        // Invalid URL, continue
                    }
                }
            }
            
            // Look for regular links in the container
            const links = container.querySelectorAll('a[href]');
            
            for (const link of links) {
                const href = link.href;
                if (href && href.startsWith('http')) {
                    try {
                        const url = new URL(href);
                        const hostname = url.hostname;
                        
                        // Skip Google's own domains and common non-result domains
                        if (hostname && 
                            !hostname.includes('google.com') && 
                            !hostname.includes('googleusercontent.com') &&
                            !hostname.includes('gstatic.com') &&
                            hostname.length > 0 &&
                            hostname.includes('.')) { // Ensure it's a valid domain with a dot
                            return hostname;
                        }
                    } catch (e) {
                        // Invalid URL, continue to next link
                        continue;
                    }
                }
            }
            
            // No valid domain found
            return null;
        } catch (error) {
            console.error('[Website Highlight] Error in extractDomainFromResult:', error);
            return null;
        }
    }
    
    /**
     * Apply highlights to all search results
     */
    function applyHighlights() {
        if (isApplyingHighlights) {
  
            return;
        }
        
        isApplyingHighlights = true;

        // Always remove existing highlights first, regardless of whether we have domains to highlight
        document.querySelectorAll('.gtrack-website-highlight').forEach(el => {
            el.classList.remove('gtrack-website-highlight');
        });
        document.querySelectorAll('.gtrack-remove-highlight').forEach(el => el.remove());
        
        // Check if there are any domains to highlight
        if (highlightedDomains.size === 0) {
            isApplyingHighlights = false;
            return;
        }

        // Find all search result containers
        const results = document.querySelectorAll('[data-hveid], .g, [jscontroller], .rc, .tF2Cxc, [data-ved]');
        
        let highlightedCount = 0;
        results.forEach(result => {
            const domain = extractDomainFromResult(result);
            if (domain && highlightedDomains.has(domain)) {
                // Check if this result is already highlighted
                if (result.querySelector('.gtrack-website-highlight')) {
                    return;
                }
                
                // Find the specific link element to highlight
                const linkElement = findLinkElement(result, domain);
                if (linkElement && !linkElement.classList.contains('gtrack-website-highlight')) {
                    highlightLink(linkElement, domain);
                    highlightedCount++;
                }
            }
        });
        
        isApplyingHighlights = false;
    }
    
    /**
     * Find the specific link element that contains the domain
     */
    function findLinkElement(result, domain) {
        // First, check for data-dtld attribute (ads)
        const adDomainElement = result.querySelector(`[data-dtld="${domain}"]`);
        if (adDomainElement) {
            // For ads, find the parent link element
            const linkElement = adDomainElement.closest('a[href]');
            if (linkElement) {
                return linkElement;
            }
        }
        
        // Check for data-rw attribute (redirect URL for ads)
        const adRedirectLink = result.querySelector('a[data-rw]');
        if (adRedirectLink) {
            try {
                const redirectUrl = adRedirectLink.getAttribute('data-rw');
                if (redirectUrl && redirectUrl.startsWith('http')) {
                    const url = new URL(redirectUrl);
                    if (url.hostname === domain) {
                        return adRedirectLink;
                    }
                }
            } catch (e) {
                // Invalid URL, continue
            }
        }
        
        // Look for regular links that match the domain
        const links = result.querySelectorAll('a[href]');
        
        // Prioritize links that are more likely to be the main result link
        const prioritizedLinks = [];
        const otherLinks = [];
        
        for (const link of links) {
            const href = link.href;
            if (href && href.startsWith('http')) {
                try {
                    const url = new URL(href);
                    if (url.hostname === domain) {
                        // Check if this looks like the main result link
                        const linkText = link.textContent.trim();
                        const hasTitle = link.querySelector('h3, .LC20lb, [role="heading"]');
                        const isMainLink = hasTitle || linkText.length > 20;
                        
                        if (isMainLink) {
                            prioritizedLinks.push(link);
                        } else {
                            otherLinks.push(link);
                        }
                    }
                } catch (e) {
                    // Invalid URL, continue to next link
                    continue;
                }
            }
        }
        
        // Return the first prioritized link, or the first other link if no prioritized ones
        return prioritizedLinks[0] || otherLinks[0];
    }
    
    /**
     * Highlight a specific link element
     */
    function highlightLink(linkElement, domain) {
        // Check if this link is already highlighted
        if (linkElement.classList.contains('gtrack-website-highlight')) {
            return;
        }
        
        // Check if remove button already exists to prevent duplicates
        if (linkElement.querySelector('.gtrack-remove-highlight')) {
            return;
        }
        
        // Get the position of this domain in the highlighted domains list
        const domainArray = Array.from(highlightedDomains);
        const domainIndex = domainArray.indexOf(domain);
        
        // Define colors for each position (max 3)
        const colors = [
            '#4CAF50', // Green for first domain
            '#2196F3', // Blue for second domain
            '#FF9800'  // Orange for third domain
        ];
        
        const color = colors[domainIndex] || '#4CAF50'; // Default to green if index is out of range
        
        // Add highlight class to the link element
        linkElement.classList.add('gtrack-website-highlight');
        
        // Override the border color with inline style for the specific color
        linkElement.style.setProperty('border-color', color, 'important');
        
        // Create a floating close button that's completely separate from the link
        const removeBtn = document.createElement('div');
        removeBtn.className = 'gtrack-remove-highlight';
        removeBtn.innerHTML = `
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
        `;
        removeBtn.title = `Remove highlight for ${domain}`;
        removeBtn.dataset.domain = domain;
        
        // Override the background color with inline style for the specific color
        removeBtn.style.setProperty('background-color', color, 'important');
        
        // Add hover effect with darker version of the same color
        const darkerColor = getDarkerColor(color);
        removeBtn.addEventListener('mouseenter', function() {
            this.style.setProperty('background-color', darkerColor, 'important');
        });
        removeBtn.addEventListener('mouseleave', function() {
            this.style.setProperty('background-color', color, 'important');
        });
        
        // Direct click handler for the remove button
        removeBtn.addEventListener('click', function(event) {
  
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            removeHighlight(domain);
        });
        
        // Position the button relative to the link element using absolute positioning
        // This will make it scroll with the page and stay connected to the link
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '-12px'; // Position above the link
        removeBtn.style.right = '-30px'; // Position to the right of the link
        removeBtn.style.zIndex = '999999';
        
        // Append the button to the link element instead of body
        // This ensures it moves with the link when scrolling
        linkElement.style.position = 'relative'; // Ensure positioning context
        linkElement.appendChild(removeBtn);
    }
    
    /**
     * Get a darker version of a color for hover effects
     */
    function getDarkerColor(color) {
        // Simple darkening function - reduce brightness by 20%
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        const darkerR = Math.max(0, r * 0.8);
        const darkerG = Math.max(0, g * 0.8);
        const darkerB = Math.max(0, b * 0.8);
        
        return `rgb(${Math.round(darkerR)}, ${Math.round(darkerG)}, ${Math.round(darkerB)})`;
    }
    
    /**
     * Handle remove highlight button clicks
     */
    function handleRemoveHighlight(event) {
  
        
        // Check if the clicked element is the remove button or contains it
        const removeButton = event.target.closest('.gtrack-remove-highlight');
        if (removeButton) {
            const domain = removeButton.dataset.domain;
  
            removeHighlight(domain);
            event.preventDefault();
            event.stopPropagation();
            return true;
        }
        return false;
    }
    
    /**
     * Remove highlight for a domain
     */
    function removeHighlight(domain) {
  
        
        chrome.storage.sync.get(['highlightedDomains'], function(result) {
            const storageDomains = result.highlightedDomains || {};
            delete storageDomains[domain];
            
            chrome.storage.sync.set({highlightedDomains: storageDomains}, function() {
      
                
                // Update local state immediately - use the global Set
                highlightedDomains.delete(domain);
                
                // Apply highlights immediately after storage update
                applyHighlights();
            });
        });
    }
    
    /**
     * Show a simple notification message (like copy feedback)
     */
    function showSimpleNotification(message, color = '#4caf50') {
        // Remove any existing simple notifications
        const existingNotifications = document.querySelectorAll('.gtrack-simple-notification');
        existingNotifications.forEach(notification => notification.remove());
        
        const notification = document.createElement('div');
        notification.className = 'gtrack-simple-notification';
        notification.textContent = message;
        notification.style.background = color;
        
        // Add to document
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
    
    /**
     * Add highlight for a domain
     */
    function addHighlight(domain) {
  
        
        chrome.storage.sync.get(['highlightedDomains'], function(result) {
            const highlightedDomains = result.highlightedDomains || {};
            
            // Check if domain is already highlighted
            if (highlightedDomains[domain]) {
  
                showSimpleNotification(
                    `Already highlighted: ${domain}`,
                    '#2196F3'
                );
                return;
            }
            
            // Check if we already have 3 domains and this one is new
            const existingDomains = Object.keys(highlightedDomains);
            if (existingDomains.length >= 3 && !highlightedDomains[domain]) {
  
                // Show a simple orange notification like copy feedback
                showSimpleNotification(
                    `Maximum 3 domains reached. Remove one first to add ${domain}`,
                    '#FF9800'
                );
                return;
            }
            
            highlightedDomains[domain] = Date.now();
            
            chrome.storage.sync.set({highlightedDomains: highlightedDomains}, function() {
  
                
                // Update local state immediately
                highlightedDomains.add(domain);
                
                // Apply highlights immediately after storage update
                applyHighlights();
                
                // Show success notification
                showSimpleNotification(
                    `Highlighted ${domain}`,
                    '#4CAF50'
                );
            });
        });
    }
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        try {
            if (request.action === 'highlight-website') {
                const domain = request.domain;
                if (domain) {
                    addHighlight(domain);
                    sendResponse({success: true});
                }
            }
        } catch (error) {
            console.error('[Website Highlight] Error in message listener:', error);
            sendResponse({success: false, error: error.message});
        }
    });
    
    // CSS styles are now in gtrack-styles.css file
    // No need to inject styles dynamically
}
