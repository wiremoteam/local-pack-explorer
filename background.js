// background.js - Production Optimized Version

// Function to send message with retry mechanism
async function sendMessageWithRetry(tabId, message, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
      console.log("✅ Message sent successfully to content script");
      return;
    } catch (error) {
      console.warn(`❌ Attempt ${attempt}/${maxRetries} failed to send message:`, error.message);
      
      if (attempt === maxRetries) {
        console.error("❌ All retry attempts failed. Content script may not be ready.");
        return;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// Function to check if content script is ready
async function isContentScriptReady(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return true;
  } catch (error) {
    return false;
  }
}

const defaultSettings = {
  enabled: false,
  latitude: 40.7580,
  longitude: -73.9855,
  location: "Times Square, New York, NY, USA",
  radius: 6400
};

// Context menu state
let contextMenuInfo = {
  keyword: null,
  tabId: null,
  domain: null
};

// Default hotkey settings
const defaultHotkeySettings = {
  enabled: true,
  key: 'L',
  ctrl: true,
  alt: false,
  shift: true
};

// Performance optimization: Cache for current header value and settings
let currentHeaderValue = null;
let currentSettings = null;
let isProcessing = false;


// Pre-computed rule templates for better performance
const RULE_TEMPLATES = {
  main: {
    id: 1,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [{
        header: "x-geo",
        operation: "set",
        value: null // Will be set dynamically
      }]
    },
    condition: {
      urlFilter: "*://*.google.com/*",
      excludedRequestDomains: ["accounts.google.com", "myaccount.google.com", "oauth2.googleapis.com", "business.google.com"],
      resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"]
    }
  },
  googleCom: {
    id: 2,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [{
        header: "x-geo",
        operation: "set",
        value: null // Will be set dynamically
      }]
    },
    condition: {
      urlFilter: "*://google.com/*",
      resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"]
    }
  },
  wwwGoogleCom: {
    id: 3,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [{
        header: "x-geo",
        operation: "set",
        value: null // Will be set dynamically
      }]
    },
    condition: {
      urlFilter: "*://www.google.com/*",
      resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"]
    }
  },

  accounts: {
    id: 4,
    priority: 100,
    action: {
      type: "allow"
    },
    condition: {
      regexFilter: ".*(accounts|signin|oauth|myaccount|business\\.google\\.com).*",
      resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest", "script", "image", "font", "stylesheet", "ping", "csp_report", "media", "websocket", "other"]
    }
  }
};

// Optimized function to create x-geo header value
function createXgeoHeader(latitude, longitude, radius = 6400) {
  const lat = Math.floor(latitude * 1e7);
  const lng = Math.floor(longitude * 1e7);
  const xgeo = `role: CURRENT_LOCATION\nproducer: DEVICE_LOCATION\nradius: ${radius}\nlatlng <\n  latitude_e7: ${lat}\n  longitude_e7: ${lng}\n>`;
  return 'a ' + btoa(xgeo);
}

// Optimized function to create rules with header value
function createRules(headerValue) {
  const rules = [
    { ...RULE_TEMPLATES.main },
    { ...RULE_TEMPLATES.googleCom },
    { ...RULE_TEMPLATES.wwwGoogleCom },
    { ...RULE_TEMPLATES.accounts }
  ];
  
  // Set header value for rules that need it
  rules[0].action.requestHeaders[0].value = headerValue;
  rules[1].action.requestHeaders[0].value = headerValue;
  rules[2].action.requestHeaders[0].value = headerValue;
  
  return rules;
}

// Error handling with retry logic
async function updateRulesWithRetry(removeRuleIds, addRules, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return new Promise((resolve, reject) => {
        chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds,
          addRules
        }, function() {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
    }
  }
}

// Optimized function to apply geolocation settings
async function applyGeolocation(settings) {
  // Prevent concurrent operations
  if (isProcessing) {
    return;
  }
  
  // Check if settings actually changed
  if (currentSettings && 
      currentSettings.enabled === settings.enabled &&
      currentSettings.latitude === settings.latitude &&
      currentSettings.longitude === settings.longitude) {
    return;
  }
  
  isProcessing = true;
  
  try {
    if (settings.enabled) {
      // Create encoded x-geo header value
      const headerValue = createXgeoHeader(settings.latitude, settings.longitude, settings.radius);
      
      // Check if header value changed
      if (currentHeaderValue !== headerValue) {
        // Update rules with retry logic
        await updateRulesWithRetry([1, 2, 3, 4, 5], createRules(headerValue));
        currentHeaderValue = headerValue;
      }
      
      // Update icon to show enabled state
      chrome.action.setIcon({path: "/img/enabled.png"});
      
      // Update tooltip with location name
      const tooltipText = settings.location || `Location: ${settings.latitude}, ${settings.longitude}`;
      chrome.action.setTitle({title: tooltipText});
      
      // Cache the tooltip for faster access
      currentSettings.tooltip = tooltipText;
    } else {
      // Remove all header rules
      await updateRulesWithRetry([1, 2, 3, 4, 5], []);
      currentHeaderValue = null;
      
      // Update icon to show disabled state
      chrome.action.setIcon({path: "/img/disabled.png"});
      
      // Update tooltip for disabled state
      chrome.action.setTitle({title: "Location spoofing disabled"});
    }
    
    // Cache current settings
    currentSettings = { ...settings };
    
  } catch (error) {
    // Silent error handling for production
  } finally {
    isProcessing = false;
  }
}

// Optimized initialization with error handling
async function initializeExtension() {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(['geoSettings', 'hotkeySettings', 'savedLocations'], resolve);
    });
    
    const settings = result.geoSettings || defaultSettings;
    const hotkeySettings = result.hotkeySettings || defaultHotkeySettings;
    
    if (!result.geoSettings) {
      await new Promise((resolve) => {
        chrome.storage.sync.set({geoSettings: defaultSettings}, resolve);
      });
    }
    
    if (!result.hotkeySettings) {
      await new Promise((resolve) => {
        chrome.storage.sync.set({hotkeySettings: defaultHotkeySettings}, resolve);
      });
          } else {
      }
    
    // Create default saved location if none exist
    if (!result.savedLocations || result.savedLocations.length === 0) {
      const defaultSavedLocation = {
        name: "New York, NY",
        latitude: 40.712775,
        longitude: -74.005973,
        location: "New York, NY, USA",
        timestamp: Date.now()
      };
      
      await new Promise((resolve) => {
        chrome.storage.sync.set({savedLocations: [defaultSavedLocation]}, resolve);
      });
    }
    
    // Check if commands are properly registered
    chrome.commands.getAll((commands) => {
      
      // Ensure the toggle command exists
      const toggleCommand = commands.find(cmd => cmd.name === 'toggle-location-spoofing');
      if (!toggleCommand) {
        console.warn('Toggle command not found! This might cause hotkey issues.');
      } else {
      }
    });
    
    // Apply settings if enabled
    if (settings.enabled) {
      await applyGeolocation(settings);
    } else {
      chrome.action.setIcon({path: "/img/disabled.png"});
      chrome.action.setTitle({title: "Location spoofing disabled"});
    }
    
  } catch (error) {
    // Silent error handling for production
  }
}

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  
  // Add a small delay to ensure commands are registered
  setTimeout(() => {
    initializeExtension();
  }, 100);
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  initializeExtension();
});

// Set default tooltip immediately
chrome.action.setTitle({title: "Location spoofing disabled"});

// Test the hotkey functionality directly
function testHotkeyFunction() {
  chrome.storage.sync.get(['geoSettings', 'hotkeySettings'], function(result) {
    const settings = result.geoSettings || defaultSettings;
    const hotkeySettings = result.hotkeySettings || defaultHotkeySettings;
    
    if (hotkeySettings.enabled) {
      const newEnabled = !settings.enabled;
      
      // Update settings
      const updatedSettings = { ...settings, enabled: newEnabled };
      chrome.storage.sync.set({geoSettings: updatedSettings});
      
      // Apply the new settings
      applyGeolocation(updatedSettings);
    }
  });
}

// Test function to verify extension is working
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'test-hotkey') {
    sendResponse({success: true, message: 'Hotkey extension is working'});
    return true; // Keep the message channel open
  }
  
  if (request.action === 'test-hotkey-function') {
    testHotkeyFunction();
    sendResponse({success: true, message: 'Hotkey function tested'});
    return true;
  }
  
  if (request.action === 'updateTooltip') {
    // Update the extension icon tooltip immediately
    const tooltipText = request.location || `Location: ${request.latitude}, ${request.longitude}`;
    chrome.action.setTitle({title: tooltipText});
    
    // Cache the tooltip for faster access
    if (currentSettings) {
      currentSettings.tooltip = tooltipText;
    }
    
    sendResponse({success: true});
    return true;
  }
  
  if (request.action === 'apply-coordinates-from-gtrack') {

    
    // Apply the coordinates immediately
    const newSettings = {
      enabled: true,
      latitude: request.coordinates.latitude,
      longitude: request.coordinates.longitude,
      location: request.location || `GTrack: ${request.coordinates.latitude},${request.coordinates.longitude}`
    };
    
    // Save to storage and apply
    chrome.storage.sync.set({geoSettings: newSettings}, function() {

      
      // Apply the geolocation settings
      applyGeolocation(newSettings);
      
      // Send success response
      sendResponse({success: true, message: 'Coordinates applied successfully'});
    });
    
    return true; // Keep the message channel open
  }
});

// Hotkey command listener
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-location-spoofing') {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(['geoSettings', 'hotkeySettings'], resolve);
      });
      
      const settings = result.geoSettings || defaultSettings;
      const hotkeySettings = result.hotkeySettings || defaultHotkeySettings;
      
      // Only toggle if hotkey is enabled
      if (hotkeySettings.enabled) {
        const newEnabled = !settings.enabled;
        
        // Update settings with new enabled state
        const updatedSettings = { ...settings, enabled: newEnabled };
        
        await new Promise((resolve) => {
          chrome.storage.sync.set({geoSettings: updatedSettings}, resolve);
        });
        
        // Apply the new settings
        await applyGeolocation(updatedSettings);
        
        // Notify popup to update UI if it's open
        chrome.runtime.sendMessage({
          action: 'hotkey-toggled',
          enabled: newEnabled
        }).catch(() => {
          // Popup might not be open, which is expected and fine
        });
        
        // Show notification about the toggle
        const status = newEnabled ? 'enabled' : 'disabled';
        
        // Detect platform for correct key display
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const keyDisplay = isMac ? 'Cmd+Shift+L' : 'Ctrl+Shift+L';
        
        try {
          const notificationId = `location-spoofing-${Date.now()}`;
          chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: newEnabled ? '/img/enabled.png' : '/img/disabled.png',
            title: 'Location Spoofing',
            message: `${status.charAt(0).toUpperCase() + status.slice(1)}`,
            requireInteraction: false
          });
          
          // Auto-dismiss notification after 1.5 seconds
          setTimeout(() => {
            chrome.notifications.clear(notificationId);
          }, 1500);
        } catch (error) {
          // Silent fallback
        }
      }
      
    } catch (error) {
      // Silent error handling
    }
  }
});

// Optimized storage change listener with debouncing
let storageChangeTimeout = null;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    if (changes.geoSettings) {
      const settings = changes.geoSettings.newValue;
      
      // Debounce rapid changes
      if (storageChangeTimeout) {
        clearTimeout(storageChangeTimeout);
      }
      
      storageChangeTimeout = setTimeout(() => {
        applyGeolocation(settings);
      }, 100); // 100ms debounce
    }
    
    // Handle hotkey settings changes
    if (changes.hotkeySettings) {
      // Note: Chrome extensions don't support dynamic command updates
      // The hotkey settings are stored for UI purposes but the actual
      // command is defined in manifest.json
    }
  }
});

// Memory optimization: Clean up on extension unload
chrome.runtime.onSuspend.addListener(() => {
  currentHeaderValue = null;
  currentSettings = null;
  if (storageChangeTimeout) {
    clearTimeout(storageChangeTimeout);
  }
});

// ===== GOOGLE MAPS PLACE TRACKER FUNCTIONALITY =====

// Track processed requests to prevent duplicates
const processedRequests = new Map();

// Store the last JSON data for debugging
let lastJsonData = null;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get-json-data') {
    if (lastJsonData) {
      sendResponse({jsonData: lastJsonData});
    } else {
      sendResponse({error: "No JSON data available"});
    }
    return true; // Keep the message channel open for async response
  }
}); 

chrome.webRequest.onCompleted.addListener(
  (details) => {
    
    
    if (details.url.startsWith("https://www.google.com/maps/preview/place?authuser=")) {
      

      if (details.url.endsWith("pf=t")) {
        return; 
      }

      // Check if we've already processed this exact URL recently
      const currentTime = Date.now();
      const lastProcessedTime = processedRequests.get(details.url);
      
      if (lastProcessedTime && (currentTime - lastProcessedTime) < 2000) {
        return;
      }
      
      // Mark this URL as processed
      processedRequests.set(details.url, currentTime);
      

      // Fetch the data
      fetch(details.url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.text();
        })
        .then(data => {

          if (data.startsWith(")]}'")) {
            data = data.slice(4); 
          }

          let parsedData;
          try {
            parsedData = JSON.parse(data);

          } catch (e) {
            console.error("Error parsing JSON:", e);
            return;
          }

          // Validate JSON structure
          
          if (Array.isArray(parsedData)) {
            
            
          }
          
          if (!parsedData || !Array.isArray(parsedData) || !parsedData[6]) {
            console.error("❌ Unexpected JSON structure:", parsedData);
            return;
          }
          
          

          // Extract business data
          const getNestedValue = (obj, path) => {
            return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), obj);
          };

          // Debug: Print EVERYTHING - comprehensive structure dump
          console.log("🔍 === COMPLETE PARSED DATA STRUCTURE ===");
          // console.log("📋 Full parsedData:", parsedData);
          // console.log("📋 parsedData type:", typeof parsedData);
          // console.log("📋 parsedData length:", parsedData.length);
          // console.log("📋 parsedData keys:", Object.keys(parsedData || {}));
          
          // Function to recursively print all data
          function printAllData(obj, path = "", maxDepth = 15, currentDepth = 0) {
            if (currentDepth >= maxDepth) {
              console.log(`⚠️ DEPTH LIMIT REACHED at ${path} (depth ${currentDepth}) - data may be truncated`);
              return;
            }
            
            if (Array.isArray(obj)) {
              console.log(`📋 ${path} (Array, length: ${obj.length}):`, obj);
              for (let i = 0; i < obj.length; i++) {
                printAllData(obj[i], `${path}[${i}]`, maxDepth, currentDepth + 1);
              }
            } else if (obj && typeof obj === 'object') {
              console.log(`📋 ${path} (Object):`, obj);
              const keys = Object.keys(obj);
              console.log(`📋 ${path} keys:`, keys);
              for (const key of keys) {
                printAllData(obj[key], `${path}.${key}`, maxDepth, currentDepth + 1);
              }
            } else {
              console.log(`📋 ${path}:`, obj);
            }
          }
          
          // Print everything with full depth
          printAllData(parsedData, "parsedData", 15, 0);
          
          // Also try to find specific patterns that might contain services
          console.log("🔍 === SEARCHING FOR SERVICES PATTERNS ===");
          function searchForServices(obj, path = "", depth = 0) {
            if (depth > 10) return;
            
            if (Array.isArray(obj)) {
              for (let i = 0; i < obj.length; i++) {
                searchForServices(obj[i], `${path}[${i}]`, depth + 1);
              }
            } else if (obj && typeof obj === 'object') {
              for (const key of Object.keys(obj)) {
                if (key.toString().toLowerCase().includes('service') || 
                    key.toString().toLowerCase().includes('amenity') ||
                    key.toString().toLowerCase().includes('feature')) {
                  console.log(`🎯 FOUND SERVICES-RELATED KEY: ${path}.${key}`, obj[key]);
                }
                searchForServices(obj[key], `${path}.${key}`, depth + 1);
              }
            }
          }
          
          searchForServices(parsedData, "parsedData", 0);
          
          console.log("🔍 === END COMPLETE STRUCTURE ===");


          const businessName = getNestedValue(parsedData, [6, 11]) || "N/A";
          const address = getNestedValue(parsedData, [6, 2]) ? parsedData[6][2].join(', ') : "N/A";
          const latitude = getNestedValue(parsedData, [6, 9, 2]) || "N/A";
          const longitude = getNestedValue(parsedData, [6, 9, 3]) || "N/A";
          const rating = getNestedValue(parsedData, [6, 4, 7]) || "N/A";
          const reviewCount = getNestedValue(parsedData, [6, 4, 8]) || "N/A";
          const placeId = getNestedValue(parsedData, [6, 78]) || "N/A";
          const website = getNestedValue(parsedData, [6, 7, 0]) || "N/A";
          const types = getNestedValue(parsedData, [6, 13]) || "N/A";
          const servicesRaw = getNestedValue(parsedData, [6, 125, 0, 0, 1, 0, 1, 0]) || "N/A";
          
          // Simple debug to see what we're getting
          console.log("🔍 Services Raw:", servicesRaw);
          console.log("🔍 Services Raw type:", typeof servicesRaw);
          // console.log("🔍 Services Raw is array:", Array.isArray(servicesRaw));
          
          // Extract service names from each array
          let services = "N/A";
          if (servicesRaw && Array.isArray(servicesRaw) && servicesRaw.length > 0) {
            console.log("🔍 Total services found:", servicesRaw.length);
            
            const serviceNames = [];
            
            // Loop through each service array
            servicesRaw.forEach((service, index) => {
              console.log(`🔍 Processing service ${index}:`, service);
              
              if (service && Array.isArray(service) && service.length > 0) {
                const serviceArray = service[0];
                // console.log(`🔍 Service ${index} array:`, serviceArray);
                
                if (serviceArray && Array.isArray(serviceArray) && serviceArray.length > 0) {
                  const serviceName = serviceArray[0];
                  console.log(`🔍 Service ${index} name:`, serviceName);
                  
                  if (serviceName && typeof serviceName === 'string' && serviceName.trim() !== "") {
                    serviceNames.push(serviceName);
                  }
                }
              }
            });
            
            console.log("🔍 All service names:", serviceNames);
            services = serviceNames.length > 0 ? serviceNames : "N/A";
          }
          const CID = getNestedValue(parsedData, [25, 3, 0, 13, 0, 0, 1]) || "N/A";
          const canClaim = getNestedValue(parsedData, [6, 49, 1]) || "N/A";
          const image = getNestedValue(parsedData, [6, 157]) || "N/A";
          const businessHours = getNestedValue(parsedData, [6, 34, 1]) || "N/A";
          const timezone = getNestedValue(parsedData, [6, 30]) || "N/A";
          const openStatus = getNestedValue(parsedData, [6, 203, 1, 4, 0]) || "N/A";
          const businessDescription = getNestedValue(parsedData, [6, 154, 0, 0]) || "N/A";
          const editBusinessUrl = getNestedValue(parsedData, [6, 96, 5, 0, 5]) || "N/A";
          const mapsUrl = details.url;
          const phone = getNestedValue(parsedData, [6, 178, 0, 0]) || "N/A";
          const description = getNestedValue(parsedData, [6, 32, 0, 1]) || "N/A";        // Count photos and posts
          const photos = getNestedValue(parsedData, [6, 42]) || [] || "N/A";
          const photoCount = Array.isArray(photos) ? photos.length : 0;
          const posts = getNestedValue(parsedData, [6, 43]) || [] || "N/A";
          const postCount = Array.isArray(posts) ? posts.length : 0;
          const servicesData = getNestedValue(parsedData, [6, 34]) || "N/A";
          // Extract opening hours from services[1] structure
          let openingHours = "N/A";
          let lastUpdate = "N/A";

          if (servicesData && Array.isArray(servicesData)) {
            // Extract opening hours from services[1]
            if (servicesData[1] && Array.isArray(servicesData[1])) {
              const hoursData = servicesData[1];
              const hoursArray = [];
              
              // Process each day (7 days of the week)
              for (let i = 0; i < Math.min(hoursData.length, 7); i++) {
                const dayData = hoursData[i];
                if (Array.isArray(dayData) && dayData.length > 1) {
                  const dayName = dayData[0] || `Day ${i + 1}`;
                  const hours = dayData[1];
                  
                  if (Array.isArray(hours) && hours.length > 0) {
                    // Extract hours from the array
                    const hoursText = hours[0] || "Closed";
                    hoursArray.push(`${dayName}: ${hoursText}`);
                  } else if (typeof hours === 'string') {
                    hoursArray.push(`${dayName}: ${hours}`);
                  } else {
                    hoursArray.push(`${dayName}: Closed`);
                  }
                }
              }
              
              if (hoursArray.length > 0) {
                openingHours = hoursArray.join(', ');
              }
            }
            
            // Extract last update from services[9]
            if (servicesData[9] && Array.isArray(servicesData[9]) && servicesData[9].length > 0) {
              const updateText = servicesData[9][0];
              if (typeof updateText === 'string' && updateText.trim()) {
                lastUpdate = updateText.trim();
              }
            }
          }
          


          

          // Always send the data - let content script handle debouncing

          // Send data to content script
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              const messageData = {
                action: 'place-data-received',
                businessName,
                address,
                placeId,
                latitude,
                longitude,
                rating,
                reviewCount,
                website,
                types,
                services,
                CID,
                canClaim,
                mapsUrl,
                phone,
                description,
                photoCount,
                postCount,
                openingHours,
                lastUpdate,
                image,
                businessHours,
                timezone,
                openStatus,
                businessDescription,
                editBusinessUrl
              };
              
              // Debug: Log what we're sending
              
              // Wait a bit for content script to be ready, then send message with retry mechanism
              setTimeout(() => {
                sendMessageWithRetry(tabs[0].id, messageData, 3);
              }, 1000);
            }
          });
        })
        .catch(error => {
          console.error("Error fetching file:", error);
        });
    }
  },
  {
    urls: ["*://www.google.com/maps/preview/place?authuser=*"],
    types: ["xmlhttprequest", "main_frame", "sub_frame", "other"]
  }
);

// Clean up processed requests periodically
setInterval(() => {
  const currentTime = Date.now();
  processedRequests.forEach((timestamp, url) => {
    if (currentTime - timestamp > 10000) { // Remove entries older than 10 seconds
      processedRequests.delete(url);
    }
  });
}, 5000);

// ===== SEARCH CONSOLE CONTEXT MENU FUNCTIONALITY =====

// Initialize context menu on extension startup
chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
});

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

// Create the context menu
function createContextMenu() {
  // Remove existing menu if it exists
  chrome.contextMenus.removeAll(() => {
    // Create the context menu item for Search Console
    chrome.contextMenus.create({
      id: 'copy-keyword',
      title: 'Copy Keyword',
      contexts: ['all'],
      documentUrlPatterns: ['https://search.google.com/search-console/*'],
      visible: false // Hidden by default, will be shown when keyword is detected
    });
    
    // Create the context menu item for website highlighting
    chrome.contextMenus.create({
      id: 'highlight-website',
      title: 'Highlight results from this website',
      contexts: ['all'],
      documentUrlPatterns: ['https://www.google.com/search*'],
      visible: false // Hidden by default, will be shown when domain is detected
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Website Highlight] Error creating context menu:', chrome.runtime.lastError);
      } else {
    
      }
    });
  });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'test-background-connection') {

    sendResponse({ success: true, message: 'Background script is responding' });
  } else if (request.action === 'preload-keyword') {
    // Pre-load keyword for faster context menu response
    contextMenuInfo.keyword = request.keyword;
    contextMenuInfo.tabId = sender.tab.id;
    
    // Update context menu immediately with the pre-loaded keyword
    chrome.contextMenus.update('copy-keyword', {
      title: `Copy: "${request.keyword}"`,
      visible: true
    });
    
    sendResponse({ success: true });
  } else if (request.action === 'keyword-detected') {
    // Store keyword info for context menu
    contextMenuInfo.keyword = request.keyword;
    contextMenuInfo.tabId = sender.tab.id;
    
    // Update context menu title with the keyword
    chrome.contextMenus.update('copy-keyword', {
      title: `Copy: "${request.keyword}"`,
      visible: true
    });
    
    sendResponse({ success: true });
  } else if (request.action === 'keyword-copied') {
    // Hide the context menu after copying
    chrome.contextMenus.update('copy-keyword', {
      visible: false
    });
    
    // Clear stored keyword info
    contextMenuInfo.keyword = null;
    contextMenuInfo.tabId = null;
    
    sendResponse({ success: true });
  } else if (request.action === 'website-domain-detected') {
    
    
    // Store domain info for website highlighting (same approach as Search Console)
    contextMenuInfo.domain = request.domain;
    contextMenuInfo.tabId = sender.tab.id;
    
    // Update context menu immediately (same as Search Console)
    chrome.contextMenus.update('highlight-website', {
      title: `Highlight results from ${request.domain}`,
      visible: true
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Website Highlight] Error updating context menu:', chrome.runtime.lastError);
        // Fallback: try to recreate the menu
        setTimeout(() => {
          chrome.contextMenus.update('highlight-website', {
            title: `Highlight results from ${request.domain}`,
            visible: true
          });
        }, 100);
      } else {

      }
    });
    
    sendResponse({ success: true });
  } else if (request.action === 'show-website-highlight-menu') {
    // Store domain info for website highlighting
    contextMenuInfo.domain = request.domain;
    contextMenuInfo.tabId = sender.tab.id;
    
    // Check if we're at the domain limit
    chrome.storage.sync.get(['highlightedDomains'], function(result) {
      const highlightedDomains = result.highlightedDomains || {};
      const existingDomains = Object.keys(highlightedDomains);
      const isAlreadyHighlighted = highlightedDomains[request.domain];
      
      let menuTitle;
      if (existingDomains.length >= 3 && !isAlreadyHighlighted) {
        menuTitle = `Maximum 3 domains reached (${request.domain})`;
      } else if (isAlreadyHighlighted) {
        menuTitle = `Already highlighted: ${request.domain}`;
      } else {
        menuTitle = `Highlight results from ${request.domain}`;
      }
      
      // Update context menu for website highlighting
      chrome.contextMenus.update('highlight-website', {
        title: menuTitle,
        visible: true
      });
    });
    
    sendResponse({ success: true });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'copy-keyword' && contextMenuInfo.keyword) {
    // Copy the keyword to clipboard
    copyKeywordToClipboard(contextMenuInfo.keyword, tab.id);
  } else if (info.menuItemId === 'highlight-website' && contextMenuInfo.domain) {
    // Highlight the website (same simple approach as Search Console)
    highlightWebsite(contextMenuInfo.domain, tab.id);
  }
});

// Copy keyword to clipboard
async function copyKeywordToClipboard(keyword, tabId) {
  try {
    // Execute script in the tab to copy to clipboard
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (textToCopy) => {
        // Modern clipboard API
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(textToCopy).then(() => {
            // Show success feedback
            showCopyFeedback(textToCopy);
          }).catch(() => {
            // Fallback for older browsers
            fallbackCopy(textToCopy);
          });
        } else {
          // Fallback for older browsers
          fallbackCopy(textToCopy);
        }
        
        function fallbackCopy(text) {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          
          try {
            document.execCommand('copy');
            showCopyFeedback(text);
          } catch (error) {
            console.error('Fallback copy failed:', error);
          }
          
          document.body.removeChild(textArea);
        }
        
        function showCopyFeedback(keyword) {
          // Create a temporary notification using CSS class
          const notification = document.createElement('div');
          notification.className = 'gtrack-copy-notification';
          notification.textContent = `✓ Copied: "${keyword}"`;
          
          document.body.appendChild(notification);
          
          // Remove after 3 seconds
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 3000);
        }
      },
      args: [keyword]
    });
    
    // Notify content script that keyword was copied
    sendMessageWithRetry(tabId, {
      action: 'keyword-copied',
      keyword: keyword
    }, 2);
    

  } catch (error) {
    console.error('[GSC Context Menu] Failed to copy keyword:', error);
  }
}

// Highlight website function
async function highlightWebsite(domain, tabId) {
  try {
    // Always send message to content script to handle highlighting and limit checking
    await sendMessageWithRetry(tabId, {
      action: 'highlight-website',
      domain: domain
    }, 2);
    
    // Hide the context menu after attempting to highlight
    chrome.contextMenus.update('highlight-website', {
      visible: false
    });
    
    // Clear stored domain info
    contextMenuInfo.domain = null;
    contextMenuInfo.tabId = null;
    

  } catch (error) {
    console.error('[Website Highlight] Failed to send highlight request:', error);
  }
}