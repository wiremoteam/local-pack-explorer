// Google Maps Place Tracker Extension
// Receives business data from background script and displays it in a panel

console.log('[Place Tracker] Script loading...');

(function() {
    'use strict';
    
    try {
        console.log('[Place Tracker] Initializing place tracker...');

        /* ───────── State Management ───────── */
        let placeTrackingEnabled = true;
        let capturedPlaceData = null;
        let placeDataCache = new Map(); // Cache for place data by place ID

        // Load setting from storage
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get(['placeTrackingEnabled'], function(result) {
                placeTrackingEnabled = result.placeTrackingEnabled !== undefined ? result.placeTrackingEnabled : true;
                console.log('[Place Tracker] Place tracking enabled:', placeTrackingEnabled);
            });
        }

        /* ───────── Place Detection and Caching ───────── */
        
        let currentPlaceId = null;
        let lastProcessedPlaceId = null;
        
        function extractPlaceIdFromURL(url) {
            console.log('[Place Tracker] Extracting place ID from URL:', url);
            
            // Try multiple patterns to extract place ID from Google Maps URL
            let placeId = null;
            
            // Pattern 1: Look for ChIJ... pattern (classic Google Place ID format)
            const pattern1 = url.match(/ChIJ[^\/\?&!]+/);
            if (pattern1) {
                placeId = pattern1[0];
                console.log('[Place Tracker] Found classic Place ID:', placeId);
                return placeId;
            }
            
            // Pattern 2: Look for /g/... pattern (newer short format)
            const pattern2 = url.match(/\/g\/([^\/\?&!]+)/);
            if (pattern2) {
                placeId = '/g/' + pattern2[1];
                console.log('[Place Tracker] Found short Place ID:', placeId);
                return placeId;
            }
            
            // Pattern 3: Look for 1sPLACE_ID: pattern (encoded in data parameter)
            const pattern3 = url.match(/1s([^:!]+):/);
            if (pattern3) {
                placeId = pattern3[1];
                console.log('[Place Tracker] Found encoded Place ID:', placeId);
                return placeId;
            }
            
            // Pattern 4: Look for place/PLACE_ID pattern (fallback)
            const pattern4 = url.match(/place\/([^\/\?&]+)/);
            if (pattern4) {
                placeId = pattern4[1];
                console.log('[Place Tracker] Found place path ID:', placeId);
                return placeId;
            }
            
            console.log('[Place Tracker] No place ID found in URL');
            return null;
        }
        
        function handlePlaceNavigation(placeId) {
            console.log('[Place Tracker] Handling place navigation for ID:', placeId);
            
            if (placeId === lastProcessedPlaceId) {
                console.log('[Place Tracker] Same place as last processed, skipping');
                return;
            }
            
            lastProcessedPlaceId = placeId;
            
            // Check if we have cached data for this place
            if (placeDataCache.has(placeId)) {
                console.log('[Place Tracker] Found cached data for place:', placeId);
                const cachedData = placeDataCache.get(placeId);
                showPlaceDataPanel(cachedData);
            } else {
                console.log('[Place Tracker] No cached data for place:', placeId, '- waiting for background script');
            }
        }
        
        function setupPlaceDetection() {
            // Monitor URL changes for Google Maps place pages
            let lastURL = window.location.href;
            
            const checkURLChange = () => {
                const currentURL = window.location.href;
                
                // Only process if URL actually changed
                if (currentURL !== lastURL) {
                    console.log('[Place Tracker] URL changed from', lastURL, 'to', currentURL);
                    lastURL = currentURL;
                    
                    // Check if we're on a Google Maps place page
                    if (currentURL.includes('https://www.google.com/maps/place/')) {
                        const placeId = extractPlaceIdFromURL(currentURL);
                        if (placeId && placeId !== currentPlaceId) {
                            console.log('[Place Tracker] New place detected:', placeId);
                            currentPlaceId = placeId;
                            
                            // Small delay to let the page load, then check cache
                            setTimeout(() => {
                                handlePlaceNavigation(placeId);
                            }, 300);
                        }
                    }
                }
            };
            
            // Check for URL changes every 500ms
            setInterval(checkURLChange, 500);
            
            // Also check on initial page load
            setTimeout(() => {
                if (window.location.href.includes('https://www.google.com/maps/place/')) {
                    const placeId = extractPlaceIdFromURL(window.location.href);
                    if (placeId) {
                        currentPlaceId = placeId;
                        handlePlaceNavigation(placeId);
                    }
                }
            }, 1000);
        }

        /* ───────── Panel Display Functions ───────── */
        
        function showPlaceDataPanel(placeData) {
            
            // Remove existing panel if it exists
            const existingPanel = document.getElementById('gtrack-place-panel');
            if (existingPanel) {
                existingPanel.remove();
            }

            // Create the panel
            const panel = document.createElement('div');
            panel.id = 'gtrack-place-panel';
            panel.className = 'gtrack-place-panel';
            
            
            // Create panel content
            const content = document.createElement('div');
            content.className = 'gtrack-place-content';
            
            // Header with business name
            const header = document.createElement('div');
            header.className = 'gtrack-place-header';
            
            // Create business image or fallback icon
            let businessImageHTML = '';
            if (placeData.image && placeData.image !== 'N/A') {
                businessImageHTML = `<img src="${placeData.image}" alt="Business Image" class="gtrack-business-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                    <div class="gtrack-header-icon" style="display:none;">🏢</div>`;
            } else {
                businessImageHTML = `<div class="gtrack-header-icon">🏢</div>`;
            }
            
            
            header.innerHTML = `
                <div class="gtrack-header-content">
                    ${businessImageHTML}
                    <div class="gtrack-header-text">
                        <h3>${placeData.name || 'Business Information'}</h3>
                    </div>
                </div>
                <button class="gtrack-close-btn" onclick="this.closest('.gtrack-place-panel').remove()" title="Close">×</button>
            `;
            
            // Body
            const body = document.createElement('div');
            body.className = 'gtrack-place-body';
            
            let bodyHTML = '';
            
            // Address
            if (placeData.address) {
                bodyHTML += `
                    <div class="gtrack-field">
                        <div class="gtrack-field-icon">📍</div>
                        <div class="gtrack-field-content">
                            <span class="gtrack-field-label">Address:</span>
                            <span class="gtrack-field-value">${placeData.address}</span>
                        </div>
                    </div>
                `;
            }
            
            // Phone
            if (placeData.phone && placeData.phone !== 'N/A') {
                bodyHTML += `
                    <div class="gtrack-field">
                        <div class="gtrack-field-icon">📞</div>
                        <div class="gtrack-field-content">
                            <span class="gtrack-field-label">Phone:</span>
                            <span class="gtrack-field-value">${placeData.phone}</span>
                        </div>
                    </div>
                `;
            }
            
            // Website
            if (placeData.website) {
                // Truncate long URLs to 35 characters for display
                const displayUrl = placeData.website.length > 35 ? 
                    placeData.website.substring(0, 35) + '...' : 
                    placeData.website;
                
                bodyHTML += `
                    <div class="gtrack-field">
                        <div class="gtrack-field-icon">🌐</div>
                        <div class="gtrack-field-content">
                            <span class="gtrack-field-label">Website:</span>
                            <a href="${placeData.website}" target="_blank" class="gtrack-field-link" title="${placeData.website}">${displayUrl}</a>
                        </div>
                    </div>
                `;
            }
            
            // Rating
            if (placeData.rating && placeData.reviewCount) {
                const stars = '★'.repeat(Math.floor(placeData.rating)) + '☆'.repeat(5 - Math.floor(placeData.rating));
                bodyHTML += `
                    <div class="gtrack-field">
                        <div class="gtrack-field-icon">⭐</div>
                        <div class="gtrack-field-content">
                            <span class="gtrack-field-label">Rating:</span>
                            <div class="gtrack-rating">
                                <span class="gtrack-stars">${stars}</span>
                                <span class="gtrack-rating-value">${placeData.rating}</span>
                                <span class="gtrack-review-count">(${placeData.reviewCount} reviews)</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Categories
            if (placeData.categories && Array.isArray(placeData.categories)) {
                const categoriesCount = placeData.categories.length;
                bodyHTML += `
                    <div class="gtrack-field">
                        <div class="gtrack-field-icon">🏷️</div>
                        <div class="gtrack-field-content">
                            <span class="gtrack-field-label">Categories (${categoriesCount}):</span>
                            <div class="gtrack-categories">
                                ${placeData.categories.map(cat => `<span class="gtrack-category-tag">${cat}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Services/Menu (expandable like hours)
            if (placeData.services && placeData.services !== 'N/A' && Array.isArray(placeData.services) && placeData.services.length > 0) {
                const servicesCount = placeData.services.length;
                const isRestaurantBusiness = isRestaurant(placeData.categories);
                const sectionLabel = isRestaurantBusiness ? 'Menu' : 'Services';
                const sectionIcon = isRestaurantBusiness ? '🍽️' : '🛠️';
                
                bodyHTML += `
                    <div class="gtrack-field gtrack-services-field">
                        <div class="gtrack-field-content">
                            <div class="gtrack-services-header">
                                <div class="gtrack-field-icon">${sectionIcon}</div>
                                <span class="gtrack-services-label">${sectionLabel} (${servicesCount})</span>
                                <span class="gtrack-expand-icon">▼</span>
                            </div>
                            <div class="gtrack-services-details" style="display: none;">
                                <div class="gtrack-categories">
                                    ${placeData.services.map(service => `<span class="gtrack-category-tag">${service}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Business Description (expandable like hours)
            if (placeData.businessDescription && placeData.businessDescription !== 'N/A') {
                const fullDescription = placeData.businessDescription;
                
                bodyHTML += `
                    <div class="gtrack-field gtrack-description-field">
                        <div class="gtrack-field-content">
                            <div class="gtrack-description-header">
                                <div class="gtrack-field-icon">📝</div>
                                <span class="gtrack-description-label">Description</span>
                                <span class="gtrack-expand-icon">▼</span>
                            </div>
                            <div class="gtrack-description-details" style="display: none;">
                                <div class="gtrack-description-content">${fullDescription}</div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Legacy Description (fallback)
            if (placeData.description && placeData.description !== 'N/A' && !placeData.businessDescription) {
                bodyHTML += `
                    <div class="gtrack-field">
                        <div class="gtrack-field-icon">📝</div>
                        <div class="gtrack-field-content">
                            <span class="gtrack-field-label">Description:</span>
                            <span class="gtrack-field-value">${placeData.description}</span>
                        </div>
                    </div>
                `;
            }
            
            // Opening Hours (expandable like description)
            if (placeData.openingHours && placeData.openingHours !== 'N/A') {
                const statusText = placeData.openStatus && placeData.openStatus !== 'N/A' ? placeData.openStatus : 'Hours';
                const lastUpdateText = placeData.lastUpdate && placeData.lastUpdate !== 'N/A' ? `${placeData.lastUpdate}` : '';
                
                // Determine status class for color coding
                const statusClass = statusText.toLowerCase().includes('closed') ? 'gtrack-status-closed' : 
                                  statusText.toLowerCase().includes('open') ? 'gtrack-status-open' : 'gtrack-status-default';
                
                bodyHTML += `
                    <div class="gtrack-field gtrack-hours-field">
                        <div class="gtrack-field-content">
                            <div class="gtrack-hours-header">
                                <div class="gtrack-field-icon">🕒</div>
                                <div class="gtrack-hours-title-section">
                                    <div class="gtrack-hours-main-title">
                                        <span class="gtrack-hours-label ${statusClass}">${statusText}</span>
                                    </div>
                                    ${lastUpdateText ? `<div class="gtrack-hours-updated">${lastUpdateText}</div>` : ''}
                                </div>
                                <span class="gtrack-expand-icon">▼</span>
                            </div>
                            <div class="gtrack-hours-details" style="display: none;">
                                <div class="gtrack-hours-content">${formatOpeningHours(placeData.openingHours)}</div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            
            // Timezone (from the new parameter)
            if (placeData.timezone && placeData.timezone !== 'N/A') {
                bodyHTML += `
                    <div class="gtrack-field">
                        <div class="gtrack-field-icon">🌍</div>
                        <div class="gtrack-field-content">
                            <span class="gtrack-field-label">Timezone:</span>
                            <span class="gtrack-field-value">${placeData.timezone}</span>
                        </div>
                    </div>
                `;
            }
            
            
            // Photos and Posts Count
            if (placeData.photoCount > 0 || placeData.postCount > 0) {
                bodyHTML += `
                    <div class="gtrack-field">
                        <div class="gtrack-field-icon">📸</div>
                        <div class="gtrack-field-content">
                            <span class="gtrack-field-label">Content:</span>
                            <div class="gtrack-content-stats">
                                ${placeData.photoCount > 0 ? `<span class="gtrack-stat">📷 ${placeData.photoCount} photos</span>` : ''}
                                ${placeData.postCount > 0 ? `<span class="gtrack-stat">📝 ${placeData.postCount} posts</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }
            
            
            // Coordinates
            if (placeData.coordinates && placeData.coordinates.latitude && placeData.coordinates.longitude) {
                bodyHTML += `
                    <div class="gtrack-field">
                        <div class="gtrack-field-icon">🗺️</div>
                        <div class="gtrack-field-content">
                            <span class="gtrack-field-label">Coordinates:</span>
                            <span class="gtrack-field-value">${placeData.coordinates.latitude}, ${placeData.coordinates.longitude}</span>
                        </div>
                    </div>
                `;
            }
            
            // Technical Info Section
            let technicalInfo = '';
            if (placeData.placeId) {
                technicalInfo += `<div class="gtrack-tech-item"><span class="gtrack-field-label">Place ID:</span> <code>${placeData.placeId}</code></div>`;
            }
            if (placeData.CID) {
                technicalInfo += `<div class="gtrack-tech-item"><span class="gtrack-field-label">CID:</span> <code>${placeData.CID}</code></div>`;
            }
            if (placeData.canClaim) {
                technicalInfo += `<div class="gtrack-tech-item"><span class="gtrack-field-label">Can Claim:</span> ${placeData.canClaim}</div>`;
            }
            
            if (technicalInfo) {
                bodyHTML += `
                    <div class="gtrack-field gtrack-field-technical">
                        <div class="gtrack-field-icon">⚙️</div>
                        <div class="gtrack-field-content">
                            <span class="gtrack-field-label">Technical Info:</span>
                            <div class="gtrack-technical-info">${technicalInfo}</div>
                        </div>
                    </div>
                `;
            }
            
            body.innerHTML = bodyHTML;
            
            // Footer with action buttons
            const footer = document.createElement('div');
            footer.className = 'gtrack-place-footer';
            footer.innerHTML = `
                <button class="gtrack-copy-btn" onclick="copyBusinessData()" title="Copy all data to clipboard">
                    📋 Copy Data
                </button>
                <button class="gtrack-export-btn" onclick="exportBusinessData()" title="Export as JSON">
                    💾 Export JSON
                </button>
            `;
            
            // Assemble panel
            content.appendChild(header);
            content.appendChild(body);
            content.appendChild(footer);
            panel.appendChild(content);
            
            // Add to page
            document.body.appendChild(panel);
            
            // Add show class to make it visible
            setTimeout(() => {
                panel.classList.add('show');
            }, 100);
            
            // Add click event listener to hours field for expand/collapse
            const hoursField = panel.querySelector('.gtrack-hours-field');
            console.log('🔍 Hours field found:', hoursField);
            if (hoursField) {
                hoursField.addEventListener('click', () => {
                    const details = hoursField.querySelector('.gtrack-hours-details');
                    const expandIcon = hoursField.querySelector('.gtrack-expand-icon');
                    
                    console.log('🔍 Hours click - details:', details, 'expandIcon:', expandIcon);
                    console.log('🔍 Current display:', details ? details.style.display : 'details not found');
                    
                    if (details && expandIcon) {
                        if (details.style.display === 'none' || details.style.display === '') {
                            details.style.display = 'block';
                            expandIcon.textContent = '▲';
                            console.log('🔍 Hours expanded');
                        } else {
                            details.style.display = 'none';
                            expandIcon.textContent = '▼';
                            console.log('🔍 Hours collapsed');
                        }
                    } else {
                        console.log('🔍 Missing elements - details:', !!details, 'expandIcon:', !!expandIcon);
                    }
                });
            } else {
                console.log('🔍 No hours field found in panel');
            }
            
            // Add click event listener to description field for expand/collapse
            const descriptionField = panel.querySelector('.gtrack-description-field');
            if (descriptionField) {
                descriptionField.addEventListener('click', () => {
                    const details = descriptionField.querySelector('.gtrack-description-details');
                    const expandIcon = descriptionField.querySelector('.gtrack-expand-icon');
                    
                    if (details.style.display === 'none') {
                        details.style.display = 'block';
                        expandIcon.textContent = '▲';
                    } else {
                        details.style.display = 'none';
                        expandIcon.textContent = '▼';
                    }
                });
            }
            
            // Add click event listener to services field for expand/collapse
            const servicesField = panel.querySelector('.gtrack-services-field');
            if (servicesField) {
                servicesField.addEventListener('click', () => {
                    const details = servicesField.querySelector('.gtrack-services-details');
                    const expandIcon = servicesField.querySelector('.gtrack-expand-icon');
                    
                    if (details.style.display === 'none') {
                        details.style.display = 'block';
                        expandIcon.textContent = '▲';
                    } else {
                        details.style.display = 'none';
                        expandIcon.textContent = '▼';
                    }
                });
            }
        }

        /* ───────── Utility Functions ───────── */
        
        // Function to parse string hours and format them properly
        function parseStringHours(hoursString) {
            if (!hoursString || hoursString === 'N/A') {
                return 'N/A';
            }
            
            // Split by comma and clean up each day
            const dayEntries = hoursString.split(',').map(entry => entry.trim());
            let formattedHours = '';
            
            dayEntries.forEach(entry => {
                // Extract day and time from "Day: Time" format
                const colonIndex = entry.indexOf(':');
                if (colonIndex > 0) {
                    const day = entry.substring(0, colonIndex).trim();
                    const time = entry.substring(colonIndex + 1).trim();
                    
                    // Determine if it's closed or has hours
                    const timeClass = time.toLowerCase().includes('closed') ? 'gtrack-time gtrack-closed' : 'gtrack-time';
                    const displayTime = time.toLowerCase().includes('closed') ? 'Closed' : time;
                    
                    formattedHours += `<div class="gtrack-day-hours">
                        <span class="gtrack-day">${day}:</span>
                        <span class="${timeClass}">${displayTime}</span>
                    </div>`;
                }
            });
            
            console.log('🔍 Parsed string hours output:', formattedHours);
            return formattedHours || 'N/A';
        }
        
        // Function to detect if a business is a restaurant
        function isRestaurant(categories) {
            if (!categories || !Array.isArray(categories)) return false;
            
            const restaurantKeywords = ['restaurant', 'food', 'meal', 'dining', 'cafe', 'bar'];
            return categories.some(cat => 
                restaurantKeywords.some(keyword => 
                    cat.toLowerCase().includes(keyword)
                )
            );
        }

        // Function to format opening hours in a clean tabular format
        function formatOpeningHours(hoursData) {
            console.log('🔍 Formatting hours data:', hoursData, typeof hoursData);
            
            if (!hoursData || hoursData === 'N/A') {
                return 'N/A';
            }
            
            // If it's already a string, parse it and format properly
            if (typeof hoursData === 'string') {
                console.log('🔍 Hours data is string, parsing:', hoursData);
                return parseStringHours(hoursData);
            }
            
            // If it's an array, format it properly
            if (Array.isArray(hoursData)) {
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                let formattedHours = '';
                
                hoursData.forEach((dayHours, index) => {
                    const day = days[index] || `Day ${index + 1}`;
                    let timeDisplay = 'Closed';
                    
                    // Check if the day has hours and they're not null/undefined
                    if (dayHours && dayHours.length >= 2 && dayHours[0] !== null && dayHours[1] !== null) {
                        const openTime = formatTime(dayHours[0]);
                        const closeTime = formatTime(dayHours[1]);
                        
                        // Only show hours if both times are valid
                        if (openTime !== 'N/A' && closeTime !== 'N/A') {
                            timeDisplay = `${openTime}–${closeTime}`;
                        }
                    }
                    
                    const timeClass = timeDisplay === 'Closed' ? 'gtrack-time gtrack-closed' : 'gtrack-time';
                    formattedHours += `<div class="gtrack-day-hours">
                        <span class="gtrack-day">${day}:</span>
                        <span class="${timeClass}">${timeDisplay}</span>
                    </div>`;
                });
                
                console.log('🔍 Formatted hours output:', formattedHours);
                return formattedHours || 'N/A';
            }
            
            return 'N/A';
        }
        
        // Function to format time (convert 24h to 12h format)
        function formatTime(timeString) {
            if (!timeString) return 'N/A';
            
            // If it's already in 12h format, return as is
            if (timeString.includes('a.m.') || timeString.includes('p.m.')) {
                return timeString;
            }
            
            // Try to parse 24h format
            const timeMatch = timeString.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
                let hours = parseInt(timeMatch[1]);
                const minutes = timeMatch[2];
                const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
                
                if (hours === 0) hours = 12;
                if (hours > 12) hours -= 12;
                
                return `${hours}:${minutes} ${ampm}`;
            }
            
            return timeString;
        }

        /* ───────── Message Handlers ───────── */

        // Listen for messages from popup and background script
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
                
                // Handle ping from background script
                if (request.action === 'ping') {
                    sendResponse({ status: 'ready' });
                    return true;
                }
                
                if (request.action === 'togglePlaceTracking') {
                    placeTrackingEnabled = request.enabled;
                    if (request.enabled) {
                        console.log('[Place Tracker] Place tracking enabled via popup');
                    } else {
                        console.log('[Place Tracker] Place tracking disabled via popup');
                        // Remove existing panel
                        const existingPanel = document.getElementById('gtrack-place-panel');
                        if (existingPanel) {
                            existingPanel.remove();
                        }
                    }
                    sendResponse({success: true});
                } else if (request.action === 'place-data-received') {
                    // Store the complete request data for debugging
                    window.lastPlaceRequest = request;
                    
                    // Debug: Log what we received
                    console.log("🔍 Place Tracker received data:");
                    console.log("  Services:", request.services);
                    console.log("  Full request:", request);
                    
                    // Store the received data
                    capturedPlaceData = {
                        name: request.businessName,
                        address: request.address,
                        placeId: request.placeId,
                        coordinates: {
                            latitude: request.latitude,
                            longitude: request.longitude
                        },
                        rating: request.rating,
                        reviewCount: request.reviewCount,
                        website: request.website,
                        categories: request.types,
                        CID: request.CID,
                        canClaim: request.canClaim,
                        mapsUrl: request.mapsUrl,
                        phone: request.phone,
                        services: request.services,
                        description: request.description,
                        photoCount: request.photoCount,
                        postCount: request.postCount,
                        openingHours: request.openingHours,
                        lastUpdate: request.lastUpdate,
                        image: request.image,
                        businessHours: request.businessHours,
                        timezone: request.timezone,
                        openStatus: request.openStatus,
                        businessDescription: request.businessDescription,
                        editBusinessUrl: request.editBusinessUrl
                    };
                    
                    console.log('[Place Tracker] Processed place data:', capturedPlaceData);
                    
                    // Cache the data by URL identifier (this means background script intercepted API call)
                    // We need to use the URL identifier for caching, not the Google Place ID
                    const urlPlaceId = currentPlaceId || extractPlaceIdFromURL(window.location.href);
                    if (urlPlaceId) {
                        placeDataCache.set(urlPlaceId, capturedPlaceData);
                        console.log('[Place Tracker] Cached NEW data for URL identifier:', urlPlaceId);
                        console.log('[Place Tracker] Google Place ID from API:', request.placeId);
                        console.log('[Place Tracker] Cache now contains', placeDataCache.size, 'places');
                        
                        // Also store the URL identifier in the cached data for reference
                        capturedPlaceData.urlPlaceId = urlPlaceId;
                    } else {
                        console.log('[Place Tracker] No URL place ID available for caching');
                    }
                    
                    // Show the panel (background script handles duplicate prevention)
                    showPlaceDataPanel(capturedPlaceData);
                    console.log('[Place Tracker] Showing panel for place:', request.placeId);
                    
                    sendResponse({success: true});
                } else if (request.action === 'debug-json-structure') {
                    // console.log('🔍 === DEBUG JSON STRUCTURE FROM BACKGROUND SCRIPT ===');
                    // console.log('📋 Structure Info:', request.structureInfo);
                    // console.log('📋 JSON Preview (first 2000 chars):', request.jsonPreview);
                    // console.log('🔍 === END DEBUG JSON STRUCTURE ===');
                    sendResponse({success: true});
                } else if (request.action === 'debug-json-start') {
                    // console.log('🔍 === DEBUG JSON START ===');
                    // console.log('📋 Total Chunks:', request.totalChunks);
                    // console.log('📋 Total Length:', request.totalLength);
                    // console.log('📋 Waiting for chunks...');
                    
                    // Initialize chunk storage
                    window.jsonChunks = [];
                    window.jsonTotalChunks = request.totalChunks;
                    window.jsonTotalLength = request.totalLength;
                    
                    sendResponse({success: true});
                } else if (request.action === 'debug-json-chunk') {
                    // Store the chunk
                    if (!window.jsonChunks) window.jsonChunks = [];
                    window.jsonChunks[request.chunkIndex] = request.chunk;
                    
     
                    
                    // Check if we have all chunks
                    if (window.jsonChunks.length === request.totalChunks && 
                        window.jsonChunks.every(chunk => chunk !== undefined)) {
                        
                          
                        // Clean up
                        window.jsonChunks = null;
                        window.jsonTotalChunks = null;
                        window.jsonTotalLength = null;
                    }
                    
                    sendResponse({success: true});
                }
            });
        }

        // Listen for storage changes
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener(function(changes, namespace) {
                if (namespace === 'sync') {
                    if (changes.placeTrackingEnabled) {
                        placeTrackingEnabled = changes.placeTrackingEnabled.newValue;
                        if (!placeTrackingEnabled) {
                            // Remove existing panel
                            const existingPanel = document.getElementById('gtrack-place-panel');
                            if (existingPanel) {
                                existingPanel.remove();
                            }
                        }
                    }
                }
            });
        }

        // Action button functions
        window.copyBusinessData = function() {
            if (!capturedPlaceData) return;
            
            // Format services data
            let servicesText = 'N/A';
            if (capturedPlaceData.services) {
                servicesText = Array.isArray(capturedPlaceData.services) ? 
                    capturedPlaceData.services.join(', ') : 
                    capturedPlaceData.services;
            }
            
            const categoriesCount = capturedPlaceData.categories ? capturedPlaceData.categories.length : 0;
            const servicesCount = capturedPlaceData.services ? capturedPlaceData.services.length : 0;
            
            const dataText = `Business: ${capturedPlaceData.name}
Address: ${capturedPlaceData.address}
Phone: ${capturedPlaceData.phone || 'N/A'}
Website: ${capturedPlaceData.website || 'N/A'}
Rating: ${capturedPlaceData.rating || 'N/A'} (${capturedPlaceData.reviewCount || 0} reviews)
Categories (${categoriesCount}): ${capturedPlaceData.categories ? capturedPlaceData.categories.join(', ') : 'N/A'}
Services (${servicesCount}): ${servicesText}
Description: ${capturedPlaceData.businessDescription || capturedPlaceData.description || 'N/A'}
Timezone: ${capturedPlaceData.timezone || 'N/A'}
Photos: ${capturedPlaceData.photoCount || 0}
Posts: ${capturedPlaceData.postCount || 0}
Coordinates: ${capturedPlaceData.coordinates ? `${capturedPlaceData.coordinates.latitude}, ${capturedPlaceData.coordinates.longitude}` : 'N/A'}
Place ID: ${capturedPlaceData.placeId || 'N/A'}`;
            
            navigator.clipboard.writeText(dataText).then(() => {
                showNotification('✅ Business data copied to clipboard!');
            }).catch(() => {
                showNotification('❌ Failed to copy data');
            });
        };
        
        window.exportBusinessData = function() {
            if (!capturedPlaceData) return;
            
            const jsonData = JSON.stringify(capturedPlaceData, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `${capturedPlaceData.name.replace(/[^a-zA-Z0-9]/g, '_')}_business_data.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showNotification('💾 Business data exported as JSON!');
        };
        
        function showNotification(message) {
            const notification = document.createElement('div');
            notification.className = 'gtrack-notification';
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.classList.add('show');
            }, 100);
            
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        }

        // Test function to manually show panel
        window.testPlacePanel = function() {
            console.log('[Place Tracker] Testing place panel...');
            const testData = {
                name: "Test Business",
                address: "123 Test Street, Test City",
                phone: "+1-555-0123",
                website: "https://example.com",
                rating: 4.5,
                reviewCount: 123,
                coordinates: {
                    latitude: 40.7128,
                    longitude: -74.0060
                },
                placeId: "test-place-id",
                categories: ["Restaurant", "Food"],
                CID: "test-cid",
                canClaim: true,
                mapsUrl: "https://maps.google.com/test",
                services: ["Delivery", "Takeout", "Dine-in"],
                description: "A great restaurant serving delicious food with excellent service.",
                photoCount: 15,
                postCount: 8
            };
            showPlaceDataPanel(testData);
        };
        
        // Test function to check if panel exists
        window.checkPanel = function() {
            const panel = document.getElementById('gtrack-place-panel');
            console.log('[Place Tracker] Panel exists:', !!panel);
            if (panel) {
                console.log('[Place Tracker] Panel classes:', panel.className);
                console.log('[Place Tracker] Panel style:', panel.style.cssText);
                console.log('[Place Tracker] Panel computed style:', window.getComputedStyle(panel));
            }
        };
        
        // Test function to check cache
        window.checkCache = function() {
            console.log('[Place Tracker] Cache contains', placeDataCache.size, 'places:');
            for (let [placeId, data] of placeDataCache) {
                console.log(`  - ${placeId}: ${data.name}`);
            }
        };

        // Global variable to store JSON data
        window.lastJsonData = null;

        // Function to request JSON data from background script
        window.getJsonData = function() {
            // console.log('[Place Tracker] Requesting JSON data from background script...');
            chrome.runtime.sendMessage({action: 'get-json-data'}, (response) => {
                if (response && response.jsonData) {
                    // console.log('🔍 === JSON DATA FROM BACKGROUND SCRIPT ===');
                    // console.log('📋 JSON Data:', response.jsonData);
                    // console.log('🔍 === END JSON DATA ===');
                    window.lastJsonData = response.jsonData;
                } else {
                    // console.log('❌ No JSON data received from background script');
                }
            });
        };

        // Simple function to show stored JSON data
        window.showJson = function() {
            if (window.lastJsonData) {
                // console.log('🔍 === STORED JSON DATA ===');
                // console.log('📋 JSON Data:', window.lastJsonData);
                // console.log('🔍 === END JSON DATA ===');
            } else {
                // console.log('❌ No JSON data stored. Try clicking on a business card first, then run getJsonData()');
            }
        };

        // Function to show the last place request data
        window.showPlaceData = function() {
            if (window.lastPlaceRequest) {
                console.log('🔍 === LAST PLACE REQUEST DATA ===');
                console.log('📋 Full request object:', window.lastPlaceRequest);
                console.log('🔍 === END PLACE REQUEST DATA ===');
            } else {
                console.log('❌ No place request data stored. Try clicking on a business card first.');
            }
        };
        
        // Function to clear cache
        window.clearCache = function() {
            placeDataCache.clear();
            console.log('[Place Tracker] Cache cleared');
        };

        // Function to check if content script is loaded
        window.checkScript = function() {
            console.log('[Place Tracker] Content script is loaded and working!');
            console.log('[Place Tracker] Available functions:');
            console.log('  - testPlacePanel() - Test the panel display');
            console.log('  - checkPanel() - Check if panel exists');
            console.log('  - checkCache() - Check cached data');
            console.log('  - getJsonData() - Get JSON from background script');
            console.log('  - showJson() - Show stored JSON data');
            console.log('  - clearCache() - Clear the cache');
            console.log('  - debugServices() - Debug services data');
        };
        
        // Function to debug services data
        window.debugServices = function() {
            console.log("🔍 === SERVICES DEBUG ===");
            if (capturedPlaceData) {
                console.log("📋 Captured place data services:", capturedPlaceData.services);
                console.log("📋 Services type:", typeof capturedPlaceData.services);
            } else {
                console.log("❌ No captured place data available");
            }
            if (window.lastPlaceRequest) {
                console.log("📋 Last request services:", window.lastPlaceRequest.services);
            } else {
                console.log("❌ No last place request available");
            }
            console.log("🔍 === END SERVICES DEBUG ===");
        };
        
        // Test function to extract place ID from current URL
        window.testPlaceIdExtraction = function() {
            const currentURL = window.location.href;
            console.log('[Place Tracker] Current URL:', currentURL);
            const placeId = extractPlaceIdFromURL(currentURL);
            console.log('[Place Tracker] Extracted place ID:', placeId);
            return placeId;
        };
        
        // Test function to check if current place is cached
        window.testCacheLookup = function() {
            const currentURL = window.location.href;
            const placeId = extractPlaceIdFromURL(currentURL);
            console.log('[Place Tracker] Current URL:', currentURL);
            console.log('[Place Tracker] Extracted place ID:', placeId);
            
            if (placeId && placeDataCache.has(placeId)) {
                const cachedData = placeDataCache.get(placeId);
                console.log('[Place Tracker] Found cached data:', cachedData);
                return cachedData;
            } else {
                console.log('[Place Tracker] No cached data found for place ID:', placeId);
                return null;
            }
        };

        // Initialize place detection system
        setupPlaceDetection();
        
        console.log('[Place Tracker] Business place tracking ready!');
        console.log('[Place Tracker] Test function available: testPlacePanel()');
        console.log('[Place Tracker] Place detection system initialized');
        
    } catch (error) {
        console.error('[Place Tracker] Error in script:', error);
        console.error('[Place Tracker] Stack trace:', error.stack);
    }
})();
