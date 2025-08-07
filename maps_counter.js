// Google Maps Counter – Business Place Numbering
// console.log('[GTrack] Google Maps Counter Script Loaded!');

// Global script state to prevent multiple initializations
if (window.gtrackScriptInitialized && window.gtrackScriptInitialized === true) {
  // console.log('[GTrack] Script already initialized, skipping...');
} else {
  // Set the flag immediately to prevent race conditions
  window.gtrackScriptInitialized = true;
  // console.log('[GTrack] Setting up script for this Google Maps instance...');

  /* ───────── State Management ───────── */
  const logged = new Set();
  let isProcessing = false;
  let lastCardCount = 0;
  let lastPlaceHref = location.href;
  let isInitialized = false;
  let initializationAttempted = false;
  let globalInitializationLock = false;
  let lastNumberUsed = 0; // Track the last number used
  let businessNumberingEnabled = true; // Track business numbering state

  // Load setting from storage on startup
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['businessNumberingEnabled'], function(result) {
      businessNumberingEnabled = result.businessNumberingEnabled !== undefined ? result.businessNumberingEnabled : true;
      // console.log('[GTrack] Loaded business numbering setting:', businessNumberingEnabled);
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

  /* ───────── Debounce helper ───────── */
  function debounce(func, delay) {
    return function (...args) {
      clearTimeout(func.timeout);
      func.timeout = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /* ───────── Badge + logging ───────── */
  function numberResults() {
    // Simple check: if disabled, remove numbers and exit
    if (!businessNumberingEnabled) {
      // console.log('[GTrack] Business numbering disabled, removing existing numbers');
      getCachedCounters().forEach(el => el.remove());
      return;
    }

    const cards = getCachedCards();
    if (!cards.length) return;

    // console.log('[GTrack] Numbering enabled, processing cards...');

    const processedCards = new Set();
    let localCounter = lastNumberUsed + 1; // Start from the last number + 1

    cards.forEach(card => {
      try {
        const placeId = getPlaceId(card);
        if (!placeId || isSponsored(card)) return;
        if (processedCards.has(placeId)) return;
        
        // Skip if card already has a number
        if (card.querySelector('.gtrack-counter')) return;
        
        processedCards.add(placeId);

        const badge = document.createElement('span');
        badge.className = 'gtrack-counter';
        badge.textContent = `#${localCounter}`;
        badge.style.cssText =
          'display:inline-flex;align-items:center;justify-content:center;background:#2563eb;' +
          'color:#fff;font-weight:600;border-radius:8px;padding:1px 6px;margin-right:8px;' +
          'font-size:12px;border:1.5px solid #fff;height:20px;min-width:22px';

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
        if (!logged.has(placeId)) {
          // console.log(`[GTrack] #${localCounter} ${nameTxt}`);
          logged.add(placeId);
        }

        localCounter++;
      } catch (error) {
        // console.warn('[GTrack] Error processing card:', error.message);
      }
    });

    // Update the last number used
    lastNumberUsed = localCounter - 1;
  }

  /* ───────── Debounced operations ───────── */
  const debouncedNumberResults = debounce(() => {
    if (isProcessing) return;
    isProcessing = true;
    try {
      numberResults();
    } catch (error) {
      // console.warn('[GTrack] Error in numberResults:', error.message);
    } finally {
      isProcessing = false;
    }
  }, 300);

  /* ───────── Observers and timers ───────── */
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
        setTimeout(() => {
          debouncedNumberResults();
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

  function detectSearchResults() {
    const cards = getCachedCards();
    const currentCount = cards.length;
    if (currentCount > 0 && currentCount !== lastCardCount) {
      lastCardCount = currentCount;
      DOM_CACHE.cards = null;
      // Increased delay to prevent flickering
      setTimeout(() => {
        debouncedNumberResults();
      }, 500);
    }
  }



  function processPlaceDetailsPage() {
    if (!location.pathname.startsWith('/maps/place/')) return;
    try {
      const nameEl = document.querySelector('.DUwDvf');
      if (!nameEl || nameEl.classList.contains('gtrack-processed')) return;
      nameEl.classList.add('gtrack-processed');

      let cid = null;
      const cidLink = document.querySelector('a[href*="0x"]');
      if (cidLink) {
        const m = cidLink.href.match(/0x[0-9a-f]+:0x[0-9a-f]+/i);
        if (m) cid = m[0].toLowerCase();
      }

      if (cid) {
        // console.log(`[GTrack][PlaceDetails] ${nameEl.textContent.trim()} | CID: ${cid}`);
      }
    } catch (error) {
      // console.warn('[GTrack] Error processing place details:', error.message);
    }
  }



  /* ───────── Initialization ───────── */
  function initializeScript() {
    if (window.gtrackInitializationInProgress) return;
    if (isInitialized || initializationAttempted || globalInitializationLock) return;
    if (paneObs || bodyObs) return;

    window.gtrackInitializationInProgress = true;
    globalInitializationLock = true;
    initializationAttempted = true;

    observeBody();
    isInitialized = true;

    setTimeout(() => {
      window.gtrackInitializationInProgress = false;
    }, 500);
  }

  /* ───────── Timers ───────── */
  setInterval(detectSearchResults, 1500);
  setInterval(() => {
    if (location.href !== lastPlaceHref) {
      lastPlaceHref = location.href;
      processPlaceDetailsPage();
    }
  }, 500);
  setInterval(() => {
    if (!isInitialized && !initializationAttempted && !globalInitializationLock && getCachedPane()) {
      initializeScript();
    }
  }, 1000);

  /* ───────── Kickoff ───────── */
  function attemptInitialization() {
    if (window.gtrackAttemptMade) return;
    if (isInitialized || initializationAttempted || globalInitializationLock) return;
    window.gtrackAttemptMade = true;
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

  // console.log('[GTrack] Business place numbering ready!');
  
  // Listen for messages from popup
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.action === 'toggleBusinessNumbering') {
        businessNumberingEnabled = request.enabled;
        if (request.enabled) {
          // console.log('[GTrack] Business numbering enabled via popup');
          // Re-initialize if not already running
          if (!isInitialized) {
            initializeScript();
          }
        } else {
          // console.log('[GTrack] Business numbering disabled via popup');
          // Remove all existing numbers
          getCachedCounters().forEach(el => el.remove());
          // Stop the script
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
}
