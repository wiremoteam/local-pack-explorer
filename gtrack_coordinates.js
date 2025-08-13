// gtrack_coordinates.js - Content script for GTrack website
// Handles copying GPS coordinates from pin popups

console.log('[GTrack Coordinates] Content script loaded');





// Function to extract coordinates from the GPS coordinates text (GTrack specific)
function extractCoordinatesFromText(text) {
  console.log('[GTrack Coordinates] Extracting coordinates from GTrack text:', text);
  
  // Try multiple patterns to be more flexible
  const patterns = [
    // Pattern 1: "Latitude: 53.3742378 Longitude: -6.3994578"
    /Latitude:\s*([-\d.]+)\s*Longitude:\s*([-\d.]+)/,
    // Pattern 2: "Latitude: 53.3742378\nLongitude: -6.3994578" (with line breaks)
    /Latitude:\s*([-\d.]+)[\s\n]*Longitude:\s*([-\d.]+)/,
    // Pattern 3: Just look for two decimal numbers after "Latitude:" and "Longitude:"
    /Latitude:.*?([-\d.]+).*?Longitude:.*?([-\d.]+)/,
    // Pattern 4: More flexible - any two decimal numbers in the text
    /([-\d.]+).*?([-\d.]+)/
  ];
  
  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      
      // Basic validation
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !isNaN(lat) && !isNaN(lng)) {
        console.log('[GTrack Coordinates] Pattern', i + 1, 'matched:', { latitude: lat, longitude: lng });
        return {
          latitude: lat,
          longitude: lng
        };
      }
    }
  }
  
  console.log('[GTrack Coordinates] No valid coordinates found in text');
  return null;
}



// Function to copy coordinates to clipboard and apply to extension
async function copyCoordinatesToClipboard(coordinates) {
  const coordText = `${coordinates.latitude},${coordinates.longitude}`;
  
  try {
    // Copy to clipboard
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(coordText);
    } else {
      fallbackCopy(coordText);
    }
    
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      console.log('[GTrack Coordinates] Extension context invalid, skipping coordinate application');
      showCopyFeedback(coordText, 'copied');
      return;
    }
    
    // Send message to extension to apply the coordinates
    const response = await chrome.runtime.sendMessage({
      action: 'apply-coordinates-from-gtrack',
      coordinates: coordinates,
      location: `GTrack: ${coordText}`
    });
    
    console.log('[GTrack Coordinates] Extension response:', response);
    
    showCopyFeedback(coordText, 'applied');
    
  } catch (error) {
    if (error.message.includes('Extension context invalidated')) {
      console.log('[GTrack Coordinates] Extension context invalidated');
      showCopyFeedback(coordText, 'copied');
      return;
    }
    console.error('[GTrack Coordinates] Failed to copy/apply coordinates:', error);
    showCopyFeedback(coordText, 'copied');
  }
}

// Fallback copy function for older browsers
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
    console.error('[GTrack Coordinates] Fallback copy failed:', error);
  }
  
  document.body.removeChild(textArea);
}

// Function to show copy feedback
function showCopyFeedback(coordinates, action = 'copied') {
  console.log('[GTrack Coordinates] Showing copy feedback:', coordinates, action);
  
  // Create a temporary notification
  const notification = document.createElement('div');
  
  if (action === 'applied') {
    notification.className = 'gtrack-copy-notification';
    notification.textContent = `✓ Copied & Applied: ${coordinates}`;
    notification.style.backgroundColor = '#059669'; // Darker green for applied
  } else {
    notification.className = 'gtrack-copy-notification';
    notification.textContent = `✓ Copied: ${coordinates}`;
  }
  
  console.log('[GTrack Coordinates] Notification element created:', notification);
  console.log('[GTrack Coordinates] Notification classes:', notification.className);
  console.log('[GTrack Coordinates] Notification text:', notification.textContent);
  
  document.body.appendChild(notification);
  console.log('[GTrack Coordinates] Notification added to DOM');
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
      console.log('[GTrack Coordinates] Notification removed from DOM');
    }
  }, 3000);
}

// Function to handle copy button clicks
function handleCopyButtonClick(event) {
  event.preventDefault();
  event.stopPropagation();
  
  // Find the GPS coordinates container
  const coordinatesContainer = event.target.closest('.pin-popup-gps-coordinates');
  if (!coordinatesContainer) {
    console.error('[GTrack Coordinates] Could not find coordinates container');
    return;
  }
  
  // Get the full text content of the container (excluding the copy button)
  let coordinatesText = '';
  
  // Iterate through all child nodes to get text content
  coordinatesContainer.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      coordinatesText += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('pin-popup-copy-button')) {
      coordinatesText += node.textContent;
    }
  });
  
  coordinatesText = coordinatesText.trim();
  console.log('[GTrack Coordinates] Found coordinates text:', coordinatesText);
  
  // Extract coordinates
  const coordinates = extractCoordinatesFromText(coordinatesText);
  if (!coordinates) {
    console.error('[GTrack Coordinates] Could not extract coordinates from text:', coordinatesText);
    return;
  }
  
  console.log('[GTrack Coordinates] Extracted coordinates:', coordinates);
  
  // Copy coordinates to clipboard and apply to extension
  copyCoordinatesToClipboard(coordinates);
}

// Function to initialize the copy functionality
function initializeCopyButtons() {
  // Find all copy buttons
  const copyButtons = document.querySelectorAll('.pin-popup-copy-button');
  
  copyButtons.forEach(button => {
    // Remove existing listeners to prevent duplicates
    button.removeEventListener('click', handleCopyButtonClick);
    // Add new listener
    button.addEventListener('click', handleCopyButtonClick);
  });
  
  console.log('[GTrack Coordinates] Initialized', copyButtons.length, 'copy buttons');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCopyButtons);
} else {
  initializeCopyButtons();
}

// Watch for dynamically added content (GTrack might load popups dynamically)
const observer = new MutationObserver((mutations) => {
  let shouldReinitialize = false;
  
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if any added node contains copy buttons
          if (node.querySelector && node.querySelector('.pin-popup-copy-button')) {
            shouldReinitialize = true;
          }
          // Also check if the node itself is a copy button
          if (node.classList && node.classList.contains('pin-popup-copy-button')) {
            shouldReinitialize = true;
          }
        }
      });
    }
  });
  
  if (shouldReinitialize) {
    console.log('[GTrack Coordinates] New copy buttons detected, reinitializing...');
    setTimeout(initializeCopyButtons, 100); // Small delay to ensure DOM is ready
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('[GTrack Coordinates] Mutation observer started');








