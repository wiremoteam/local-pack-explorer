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

    // Show search result count
    var showSearchResultCount = function() {
        chrome.storage.sync.get({
            showTotalResults: true
        }, function(settings) {
            if (!settings.showTotalResults) {
                return;
            }

            const observer = new MutationObserver((mutations, obs) => {
                const toolsButton = document.getElementById('hdtb-tls');
                
                if (toolsButton) {
                    if (toolsButton.getAttribute('aria-expanded') !== 'true') {
                        toolsButton.click();
                    } else {
                        obs.disconnect();
                    }
                } else {
                }
            });

            const config = {
                childList: true,
                subtree: true,
                attributes: true
            };

            observer.observe(document.body, config);

            setTimeout(() => {
                observer.disconnect();
            }, 10000);
        });
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
            
            // Check if show total results changed
            if (changes.showTotalResults) {
                // console.log('[SERP Counter] Show total results setting changed');
                showSearchResultCount();
            }
        }
    });

    // Initialize only once - no storage change listeners to avoid duplicates
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            renderCounterHtml();
            showSearchResultCount();
        });
    } else {
        renderCounterHtml();
        showSearchResultCount();
    }
}
