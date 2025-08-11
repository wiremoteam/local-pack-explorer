// Google Maps Counter Extension
// Counts and displays numbered badges on Google Maps search results

// Global script state to prevent multiple initializations
if (window.mapsCounterInitialized && window.mapsCounterInitialized === true) {
    console.log('[Maps Counter] Script already initialized, skipping...');
} else {
    // Set the flag immediately to prevent race conditions
    window.mapsCounterInitialized = true;
    console.log('[Maps Counter] Setting up script for this Google Maps instance...');

    /* ───────── State Management ───────── */
    let isProcessing = false;
    let lastCardCount = 0;
    let lastPlaceHref = location.href;
    let isInitialized = false;
    let initializationAttempted = false;
    let globalInitializationLock = false;
    let lastNumberUsed = 0; // Track the last number used for regular results
    let lastAdNumberUsed = 0; // Track the last number used for ads
    let mapsNumberingEnabled = true; // Track Maps Result numbering state
    let lastSearchQuery = ''; // Track the last search query

    // Load setting from storage on startup
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['mapsNumberingEnabled'], function(result) {
            mapsNumberingEnabled = result.mapsNumberingEnabled !== undefined ? result.mapsNumberingEnabled : true;
            console.log('[Maps Counter] Loaded Maps Result numbering setting:', mapsNumberingEnabled);
        });
    }

    /* ───────── Cached DOM Queries ───────── */
    const DOM_CACHE = {
        cards: null,
        counters: null,
        pane: null,
        lastUpdate: 0
    };

    function getCachedCards() {
        const now = Date.now();
        if (!DOM_CACHE.cards || now - DOM_CACHE.lastUpdate > 100) {
            DOM_CACHE.cards = document.querySelectorAll('.Nv2PK');
            DOM_CACHE.lastUpdate = now;
        }
        return DOM_CACHE.cards || document.querySelectorAll('.Nv2PK');
    }

    function getCachedCounters() {
        return document.querySelectorAll('.gtrack-counter');
    }

    function getCachedPane() {
        if (!DOM_CACHE.pane) {
            DOM_CACHE.pane = document.querySelector('div[role="feed"]');
        }
        return DOM_CACHE.pane;
    }

    /* ───────── DOM helpers (optimized) ───────── */
    const isSponsored = card => {
        try {
            return [...card.querySelectorAll('span,div,label,p')]
                .some(el => el.textContent?.trim().toLowerCase() === 'sponsored');
        } catch (error) {
            return false;
        }
    };

    const getPlaceId = card => {
        try {
            const href = card.querySelector('a.hfpxzc')?.href || '';
            const m = href.match(/ChIJ[a-zA-Z0-9_-]+(?:\?|$)/);
            return m ? m[0].replace(/\?$/, '') : null;
        } catch (error) {
            return null;
        }
    };

    // Function to get current search query from URL
    function getCurrentSearchQuery() {
        try {
            const url = new URL(window.location.href);
            return url.searchParams.get('q') || url.pathname.replace('/maps/search/', '').replace('/maps/place/', '') || '';
        } catch (error) {
            return '';
        }
    }

    // Function to detect if content has been refreshed
    function isContentRefreshed() {
        const cards = getCachedCards();
        if (cards.length === 0) return false;
        
        // Check if ALL cards don't have badges
        let cardsWithoutBadges = 0;
        let totalCards = 0;
        
        cards.forEach(card => {
            totalCards++;
            if (!card.querySelector('.gtrack-counter, .gtrack-ad-counter-badge')) {
                cardsWithoutBadges++;
            }
        });
        
        // If ALL cards don't have badges, content was refreshed
        if (totalCards > 0 && cardsWithoutBadges === totalCards) {
            console.log(`[Maps Counter] Content refresh detected: all ${totalCards} cards have no badges`);
            return true;
        }
        
        return false;
    }

    /* ───────── Debounce helper ───────── */
    function debounce(func, delay) {
        return function (...args) {
            clearTimeout(func.timeout);
            func.timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /* ───────── Numbering Functions ───────── */
    
    // Function to number regular Maps results
    function numberRegularResults() {
        const cards = getCachedCards();
        if (!cards.length) return;

        // Stop numbering after 20 results
        if (lastNumberUsed >= 20) {
            console.log('[Maps Counter] Reached 20 results limit, stopping numbering');
            return;
        }

        console.log(`[Maps Counter] Numbering regular results... (${cards.length} cards, starting from ${lastNumberUsed + 1}, limit: 20)`);

        const processedCards = new Set();
        let localCounter = lastNumberUsed + 1; // Start from the last number + 1
        let newCardsCount = 0;

        cards.forEach(card => {
            try {
                const placeId = getPlaceId(card);
                if (!placeId || isSponsored(card)) return; // Skip ads
                
                // Check if this card already has a badge
                if (card.querySelector('.gtrack-counter, .gtrack-ad-counter-badge')) {
                    console.log(`[Maps Counter] Skipping already numbered card: ${card.querySelector('.qBF1Pd, .fontHeadlineSmall')?.textContent?.trim() || 'unknown'}`);
                    return;
                }
                
                // Double-check the limit before processing
                if (localCounter > 20) {
                    console.log(`[Maps Counter] Reached 20 results limit, stopping at #${localCounter}`);
                    return;
                }
                
                processedCards.add(placeId);

                const badge = document.createElement('span');
                badge.className = 'gtrack-counter';
                badge.textContent = localCounter;

                const nameEl = card.querySelector('.qBF1Pd, .fontHeadlineSmall');
                if (nameEl) {
                    if (!nameEl.parentElement.classList.contains('gtrack-wrap')) {
                        const wrap = document.createElement('span');
                        wrap.className = 'gtrack-wrap';
                        wrap.style.cssText = 'display:inline-flex;align-items:center;gap:2px';
                        nameEl.parentElement.insertBefore(wrap, nameEl);
                        wrap.append(badge, nameEl);
                    } else {
                        nameEl.parentElement.insertBefore(badge, nameEl);
                    }
                    nameEl.style.margin = '0';
                } else {
                    card.prepend(badge);
                }

                const nameTxt = nameEl ? nameEl.textContent.trim() : '(no name)';
                console.log(`[Maps Counter] #${localCounter} ${nameTxt}`);

                localCounter++;
                newCardsCount++;
            } catch (error) {
                console.warn('[Maps Counter] Error processing regular card:', error.message);
            }
        });

        // Update the last number used, but cap it at 20
        lastNumberUsed = Math.min(localCounter - 1, 20);
        console.log(`[Maps Counter] Regular results numbered: ${newCardsCount} new cards (lastNumberUsed: ${lastNumberUsed})`);
    }

    // Function to number Maps ads
    function numberMapsAds() {
        const cards = getCachedCards();
        if (!cards.length) return;

        // Stop numbering ads after 20 results
        if (lastNumberUsed >= 20) {
            console.log('[Maps Counter] Reached 20 results limit, stopping ad numbering');
            return;
        }

        console.log(`[Maps Counter] Numbering ads... (${cards.length} cards, starting from ${lastAdNumberUsed + 1}, limit: 20)`);

        let adCounter = lastAdNumberUsed + 1; // Start from the last ad number + 1
        let newAdsCount = 0;

        cards.forEach(card => {
            try {
                const placeId = getPlaceId(card);
                const isAd = isSponsored(card);
                
                if (!placeId) {
                    console.log(`[Maps Counter] Skipping ad with no placeId: ${card.querySelector('.qBF1Pd, .fontHeadlineSmall')?.textContent?.trim() || 'unknown'}`);
                    return;
                }
                
                if (!isAd) {
                    return; // Skip non-ads
                }
                
                const nameEl = card.querySelector('.qBF1Pd, .fontHeadlineSmall');
                const nameTxt = nameEl ? nameEl.textContent.trim() : '(no name)';

                console.log(`[Maps Counter] Processing ad: ${nameTxt} (counter: ${adCounter})`);

                // Check if card already has an ad number
                if (card.querySelector('.gtrack-ad-counter-badge')) {
                    console.log(`[Maps Counter] Skipping already numbered ad: ${nameTxt}`);
                    return; // Skip if already numbered
                }

                // Also check if it has a regular badge and remove it (shouldn't happen for ads)
                const regularBadge = card.querySelector('.gtrack-counter');
                if (regularBadge) {
                    console.log(`[Maps Counter] Removing incorrect regular badge from ad: ${nameTxt}`);
                    regularBadge.remove();
                }

                const adBadge = document.createElement('span');
                adBadge.className = 'gtrack-ad-counter-badge';
                adBadge.textContent = adCounter;

                if (nameEl) {
                    if (!nameEl.parentElement.classList.contains('gtrack-wrap')) {
                        const wrap = document.createElement('span');
                        wrap.className = 'gtrack-wrap';
                        wrap.style.cssText = 'display:inline-flex;align-items:center;gap:2px';
                        nameEl.parentElement.insertBefore(wrap, nameEl);
                        wrap.append(adBadge, nameEl);
                    } else {
                        nameEl.parentElement.insertBefore(adBadge, nameEl);
                    }
                    nameEl.style.margin = '0';
                } else {
                    card.prepend(adBadge);
                }

                console.log(`[Maps Counter] Ad #${adCounter} ${nameTxt}`);

                adCounter++;
                newAdsCount++;
            } catch (error) {
                console.warn('[Maps Counter] Error processing ad card:', error.message);
            }
        });

        // Update the last ad number used, but cap it at 20
        lastAdNumberUsed = Math.min(adCounter - 1, 20);
        console.log(`[Maps Counter] Ads numbered: ${newAdsCount} new ads (lastAdNumberUsed: ${lastAdNumberUsed})`);
    }

    // Main function to run both numbering functions
    function runNumbering() {
        // Check if numbering is enabled
        if (!mapsNumberingEnabled) {
            console.log('[Maps Counter] Maps Result numbering disabled, removing existing numbers');
            getCachedCounters().forEach(el => el.remove());
            document.querySelectorAll('.gtrack-ad-counter-badge').forEach(el => el.remove());
            return;
        }

        // Check if this is a new search
        const currentSearchQuery = getCurrentSearchQuery();
        if (currentSearchQuery !== lastSearchQuery) {
            console.log('[Maps Counter] New search detected, resetting counters');
            lastSearchQuery = currentSearchQuery;
            lastNumberUsed = 0; // Reset regular result counter for new search
            lastAdNumberUsed = 0; // Reset ad counter for new search
        }

        // Check if content was refreshed
        if (isContentRefreshed()) {
            console.log('[Maps Counter] Content refresh detected - resetting all counters');
            lastNumberUsed = 0;
            lastAdNumberUsed = 0;
        }

        console.log('[Maps Counter] Running numbering functions...');
        
        // Run both numbering functions
        numberRegularResults();
        numberMapsAds();
    }

    /* ───────── Debounced operations ───────── */
    let isNumberingInProgress = false;
    
    const debouncedRunNumbering = debounce(() => {
        if (isNumberingInProgress) {
            console.log('[Maps Counter] Numbering already in progress, skipping');
            return;
        }
        isNumberingInProgress = true;
        try {
            runNumbering();
        } catch (error) {
            console.warn('[Maps Counter] Error in runNumbering:', error.message);
        } finally {
            setTimeout(() => {
                isNumberingInProgress = false;
            }, 500);
        }
    }, 300);

    /* ───────── Content Detection ───────── */
    function detectSearchResults() {
        const cards = getCachedCards();
        const currentCount = cards.length;
        if (currentCount > 0 && currentCount !== lastCardCount) {
            const previousCount = lastCardCount;
            lastCardCount = currentCount;
            DOM_CACHE.cards = null;
            console.log(`[Maps Counter] New content detected: ${currentCount} cards (previous: ${previousCount})`);
            
            setTimeout(() => {
                debouncedRunNumbering();
            }, 500);
        }
    }

    /* ───────── Observers ───────── */
    let paneObs = null;
    let bodyObs = null;

    function observePane() {
        const pane = getCachedPane();
        if (!pane || paneObs) return;

        paneObs = new MutationObserver(mutations => {
            let hasChanges = false;
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.classList.contains('Nv2PK') || node.querySelector('.Nv2PK')) {
                                hasChanges = true;
                            }
                        }
                    });
                }
            });
            if (hasChanges) {
                DOM_CACHE.cards = null;
                console.log('[Maps Counter] Content change detected, updating numbers');
                setTimeout(() => {
                    debouncedRunNumbering();
                }, 500);
            }
        });

        paneObs.observe(pane, { childList: true, subtree: true });
    }

    function observeBody() {
        if (bodyObs) bodyObs.disconnect();
        bodyObs = new MutationObserver(() => {
            if (getCachedPane()) {
                observePane();
                bodyObs.disconnect();
                bodyObs = null;
            }
        });
        bodyObs.observe(document.body, { childList: true, subtree: true });
    }

    /* ───────── Initialization ───────── */
    function initializeScript() {
        if (window.mapsCounterInitializationInProgress) return;
        if (isInitialized || initializationAttempted || globalInitializationLock) return;
        if (paneObs || bodyObs) return;

        window.mapsCounterInitializationInProgress = true;
        globalInitializationLock = true;
        initializationAttempted = true;

        observeBody();
        isInitialized = true;

        setTimeout(() => {
            window.mapsCounterInitializationInProgress = false;
        }, 500);
    }

    /* ───────── Timers ───────── */
    setInterval(detectSearchResults, 1500);
    setInterval(() => {
        if (!isInitialized && !initializationAttempted && !globalInitializationLock && getCachedPane()) {
            initializeScript();
        }
    }, 1000);

    /* ───────── Kickoff ───────── */
    function attemptInitialization() {
        if (window.mapsCounterAttemptMade) return;
        if (isInitialized || initializationAttempted || globalInitializationLock) return;
        window.mapsCounterAttemptMade = true;
        initializeScript();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(attemptInitialization, 500);
        });
    } else {
        setTimeout(attemptInitialization, 500);
    }

    window.addEventListener('beforeunload', () => {
        if (paneObs) paneObs.disconnect();
        if (bodyObs) bodyObs.disconnect();
    });

    console.log('[Maps Counter] Business place numbering ready!');
    
    // Listen for messages from popup
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            if (request.action === 'toggleMapsNumbering') {
                mapsNumberingEnabled = request.enabled;
                if (request.enabled) {
                    console.log('[Maps Counter] Maps Result numbering enabled via popup');
                    if (!isInitialized) {
                        initializeScript();
                    }
                } else {
                    console.log('[Maps Counter] Maps Result numbering disabled via popup');
                    getCachedCounters().forEach(el => el.remove());
                    document.querySelectorAll('.gtrack-ad-counter-badge').forEach(el => el.remove());
                    if (paneObs) {
                        paneObs.disconnect();
                        paneObs = null;
                    }
                    if (bodyObs) {
                        bodyObs.disconnect();
                        bodyObs = null;
                    }
                    isInitialized = false;
                    initializationAttempted = false;
                    globalInitializationLock = false;
                }
                sendResponse({success: true});
            }
        });
    }

    // Listen for storage changes
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'sync') {
            if (changes.mapsNumberingEnabled) {
                console.log('[Maps Counter] Maps numbering setting changed:', changes.mapsNumberingEnabled.newValue);
                mapsNumberingEnabled = changes.mapsNumberingEnabled.newValue;
                if (mapsNumberingEnabled) {
                    if (!isInitialized) {
                        initializeScript();
                    }
                } else {
                    console.log('[Maps Counter] Removing all counters - setting disabled');
                    getCachedCounters().forEach(el => el.remove());
                    document.querySelectorAll('.gtrack-ad-counter-badge').forEach(el => el.remove());
                }
            }
        }
    });
}
