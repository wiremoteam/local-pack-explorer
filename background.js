// background.js - Production Optimized Version
const defaultSettings = {
  enabled: false,
  latitude: 40.7580,
  longitude: -73.9855,
  location: "Times Square, New York, NY, USA"
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
  labs: {
    id: 4,
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
      urlFilter: "*://labs.google/*",
      resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"]
    }
  },
  accounts: {
    id: 5,
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
function createXgeoHeader(latitude, longitude) {
  const lat = Math.floor(latitude * 1e7);
  const lng = Math.floor(longitude * 1e7);
  const xgeo = `role: CURRENT_LOCATION\nproducer: DEVICE_LOCATION\nradius: 6400\nlatlng <\n  latitude_e7: ${lat}\n  longitude_e7: ${lng}\n>`;
  return 'a ' + btoa(xgeo);
}

// Optimized function to create rules with header value
function createRules(headerValue) {
  const rules = [
    { ...RULE_TEMPLATES.main },
    { ...RULE_TEMPLATES.googleCom },
    { ...RULE_TEMPLATES.wwwGoogleCom },
    { ...RULE_TEMPLATES.labs },
    { ...RULE_TEMPLATES.accounts }
  ];
  
  // Set header value for rules that need it
  rules[0].action.requestHeaders[0].value = headerValue;
  rules[1].action.requestHeaders[0].value = headerValue;
  rules[2].action.requestHeaders[0].value = headerValue;
  rules[3].action.requestHeaders[0].value = headerValue;
  
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
      const headerValue = createXgeoHeader(settings.latitude, settings.longitude);
      
      // Check if header value changed
      if (currentHeaderValue !== headerValue) {
        // Update rules with retry logic
        await updateRulesWithRetry([1, 2, 3, 4, 5], createRules(headerValue));
        currentHeaderValue = headerValue;
      }
      
      // Update icon to show enabled state
      chrome.action.setIcon({path: "/img/enabled.png"});
    } else {
      // Remove all header rules
      await updateRulesWithRetry([1, 2, 3, 4, 5], []);
      currentHeaderValue = null;
      
      // Update icon to show disabled state
      chrome.action.setIcon({path: "/img/disabled.png"});
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
      chrome.storage.sync.get(['geoSettings', 'hotkeySettings'], resolve);
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
    }
    
    // Apply settings if enabled
    if (settings.enabled) {
      await applyGeolocation(settings);
    } else {
      chrome.action.setIcon({path: "/img/disabled.png"});
    }
    
  } catch (error) {
    // Silent error handling for production
  }
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed - initializing...');
  initializeExtension();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension starting up - initializing...');
  initializeExtension();
});

// Add a simple test message
console.log('Background script loaded - hotkey extension ready');

// Test the hotkey functionality directly
function testHotkeyFunction() {
  console.log('Testing hotkey function directly...');
  
  chrome.storage.sync.get(['geoSettings', 'hotkeySettings'], function(result) {
    const settings = result.geoSettings || defaultSettings;
    const hotkeySettings = result.hotkeySettings || defaultHotkeySettings;
    
    console.log('Current settings:', settings);
    console.log('Hotkey settings:', hotkeySettings);
    
    if (hotkeySettings.enabled) {
      const newEnabled = !settings.enabled;
      console.log('Would toggle from', settings.enabled, 'to', newEnabled);
      
      // Update settings
      const updatedSettings = { ...settings, enabled: newEnabled };
      chrome.storage.sync.set({geoSettings: updatedSettings});
      
      // Apply the new settings
      applyGeolocation(updatedSettings);
      
      console.log('Hotkey test completed successfully');
    } else {
      console.log('Hotkey is disabled in settings');
    }
  });
}

// Test function to verify extension is working
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in background:', request);
  
  if (request.action === 'test-hotkey') {
    console.log('Test hotkey function called');
    sendResponse({success: true, message: 'Hotkey extension is working'});
    return true; // Keep the message channel open
  }
  
  if (request.action === 'test-hotkey-function') {
    console.log('Testing hotkey function...');
    testHotkeyFunction();
    sendResponse({success: true, message: 'Hotkey function tested'});
    return true;
  }
});

// Hotkey command listener
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);
  
  if (command === 'toggle-location-spoofing') {
    console.log('Toggle location spoofing command received');
    
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(['geoSettings', 'hotkeySettings'], resolve);
      });
      
      const settings = result.geoSettings || defaultSettings;
      const hotkeySettings = result.hotkeySettings || defaultHotkeySettings;
      
      console.log('Current settings:', settings);
      console.log('Hotkey settings:', hotkeySettings);
      
      // Only toggle if hotkey is enabled
      if (hotkeySettings.enabled) {
        const newEnabled = !settings.enabled;
        console.log('Toggling from', settings.enabled, 'to', newEnabled);
        
        // Update settings with new enabled state
        const updatedSettings = { ...settings, enabled: newEnabled };
        
        await new Promise((resolve) => {
          chrome.storage.sync.set({geoSettings: updatedSettings}, resolve);
        });
        
        // Apply the new settings
        await applyGeolocation(updatedSettings);
        
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
            message: `Location spoofing ${status} via hotkey (${keyDisplay})`,
            requireInteraction: false
          });
          
          // Auto-dismiss notification after 1 second
          setTimeout(() => {
            chrome.notifications.clear(notificationId);
          }, 1000);
        } catch (error) {
          // Fallback: just log the action
          console.log(`Location spoofing ${status} via hotkey (${keyDisplay})`);
        }
      } else {
        console.log('Hotkey is disabled');
      }
      
    } catch (error) {
      console.error('Error in hotkey command:', error);
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
      console.log('Hotkey settings updated:', changes.hotkeySettings.newValue);
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