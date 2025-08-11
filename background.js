// background.js - Production Optimized Version
const defaultSettings = {
  enabled: false,
  latitude: 40.7580,
  longitude: -73.9855,
  location: "Times Square, New York, NY, USA"
};

// Context menu state
let contextMenuInfo = {
  keyword: null,
  tabId: null,
  isRebuilding: false // Flag to prevent infinite loops during rebuild
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
    // console.log('Initializing extension...');
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(['geoSettings', 'hotkeySettings'], resolve);
    });
    
          // console.log('Storage result:', result);
    const settings = result.geoSettings || defaultSettings;
    const hotkeySettings = result.hotkeySettings || defaultHotkeySettings;
    
    if (!result.geoSettings) {
      await new Promise((resolve) => {
        chrome.storage.sync.set({geoSettings: defaultSettings}, resolve);
      });
    }
    
    if (!result.hotkeySettings) {
      // console.log('Setting default hotkey settings...');
      await new Promise((resolve) => {
        chrome.storage.sync.set({hotkeySettings: defaultHotkeySettings}, resolve);
      });
      // console.log('Default hotkey settings saved');
          } else {
        // console.log('Hotkey settings already exist:', result.hotkeySettings);
      }
    
    // Check if commands are properly registered
    chrome.commands.getAll((commands) => {
      // console.log('Available commands:', commands);
      
      // Ensure the toggle command exists
      const toggleCommand = commands.find(cmd => cmd.name === 'toggle-location-spoofing');
      if (!toggleCommand) {
        console.warn('Toggle command not found! This might cause hotkey issues.');
      } else {
        // console.log('Toggle command found:', toggleCommand);
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
      // console.log('Extension installed/updated:', details.reason);
  
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
});

// Hotkey command listener
chrome.commands.onCommand.addListener(async (command) => {
        // console.log('Command received:', command);
  if (command === 'toggle-location-spoofing') {
          // console.log('Toggle command executed successfully');
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(['geoSettings', 'hotkeySettings'], resolve);
      });
      
      const settings = result.geoSettings || defaultSettings;
      const hotkeySettings = result.hotkeySettings || defaultHotkeySettings;
      
              // console.log('Hotkey settings:', hotkeySettings);
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
    // Create the context menu item
    chrome.contextMenus.create({
      id: 'copy-keyword',
      title: 'Copy Keyword',
      contexts: ['all'],
      documentUrlPatterns: ['https://search.google.com/search-console/*'],
      visible: false // Hidden by default, will be shown when keyword is detected
    });
  });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'keyword-detected') {
    // Store keyword info for context menu
    contextMenuInfo.keyword = request.keyword;
    contextMenuInfo.tabId = sender.tab.id;
    contextMenuInfo.isRebuilding = true;
    
    // Update context menu title with the keyword
    chrome.contextMenus.update('copy-keyword', {
      title: `Copy: "${request.keyword}"`,
      visible: true
    }, () => {
      // Reset rebuilding flag after menu update
      setTimeout(() => {
        contextMenuInfo.isRebuilding = false;
      }, 100);
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
    contextMenuInfo.isRebuilding = false;
    
    sendResponse({ success: true });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'copy-keyword' && contextMenuInfo.keyword) {
    // Copy the keyword to clipboard
    copyKeywordToClipboard(contextMenuInfo.keyword, tab.id);
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
          // Create a temporary notification
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            font-family: 'Google Sans', Arial, sans-serif;
            font-size: 14px;
            z-index: 10001;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
          `;
          notification.textContent = `✓ Copied: "${keyword}"`;
          
          // Add animation styles
          const style = document.createElement('style');
          style.textContent = `
            @keyframes slideIn {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `;
          document.head.appendChild(style);
          
          document.body.appendChild(notification);
          
          // Remove after 3 seconds
          setTimeout(() => {
            if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
            if (style.parentNode) {
              style.parentNode.removeChild(style);
            }
          }, 3000);
        }
      },
      args: [keyword]
    });
    
    // Notify content script that keyword was copied
    chrome.tabs.sendMessage(tabId, {
      action: 'keyword-copied',
      keyword: keyword
    }).catch(() => {
      // Content script might not be listening, which is fine
    });
    
    console.log('[GSC Context Menu] Copied keyword:', keyword);
  } catch (error) {
    console.error('[GSC Context Menu] Failed to copy keyword:', error);
  }
}