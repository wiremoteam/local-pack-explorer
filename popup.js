// popup.js
document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const locationInput = document.getElementById('location-input');
  const latitudeInput = document.getElementById('latitude');
  const longitudeInput = document.getElementById('longitude');
  const enableToggle = document.getElementById('enable-toggle');
  const statusText = document.getElementById('status-text');
  const businessNumberingToggle = document.getElementById('business-numbering-toggle');
  const businessNumberingStatus = document.getElementById('business-numbering-status');
  const optionsLink = document.getElementById('options-link');
  const businessNumberingSection = document.getElementById('business-numbering-section');
  const suggestions = document.getElementById('suggestions');
  const resetButton = document.getElementById('reset-button');
  
  // Load saved settings
  chrome.storage.sync.get(['geoSettings', 'businessNumberingEnabled'], function(result) {
    const settings = result.geoSettings || {
      enabled: false,
      latitude: 40.7580,
      longitude: -73.9855,
      location: "Times Square, New York, NY, USA"
    };
    
    const businessNumberingEnabled = result.businessNumberingEnabled !== undefined ? result.businessNumberingEnabled : true;
    
    // Update UI with saved settings
    latitudeInput.value = settings.latitude;
    longitudeInput.value = settings.longitude;
    locationInput.placeholder = settings.location || "Enter a location or lat,lng";
    enableToggle.checked = settings.enabled;
    businessNumberingToggle.checked = businessNumberingEnabled;
    updateStatusText(settings.enabled);
    updateBusinessNumberingStatus(businessNumberingEnabled);
  });
  
  // Enhanced function to extract coordinates from various formats
  function extractCoordinates(input) {
    // Early return if input is too short
    if (!input || input.length < 3) return null;
    
    // Clean up the input
    const cleanInput = input.replace(/[()°'"NSEWnsew:lat longitude]/gi, ' ').trim();
    
    // Check for various patterns
    const patterns = [
      // Standard format: 37.422388,-122.0841883
      /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/,
      
      // Format with labels: Lat: 37.422388, Long: -122.0841883 (already cleaned above)
      /(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)/,
      
      // Just look for two decimal numbers near each other
      /(-?\d+(\.\d+)?)(?:[\s,;]+)(-?\d+(\.\d+)?)/
    ];
    
    for (const pattern of patterns) {
      const match = cleanInput.match(pattern);
      if (match) {
        // Ensure these are valid numbers
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[3] || match[4] || "0"); // Fallback to prevent NaN
        
        // Basic validation - latitude must be between -90 and 90
        if (lat >= -90 && lat <= 90 && !isNaN(lng)) {
          return {
            latitude: lat,
            longitude: lng
          };
        }
      }
    }
    
    return null; // No valid coordinates found
  }
  
  // Location search event listener
  locationInput.addEventListener('input', debounce(function() {
    if (locationInput.value.length < 2) {
      suggestions.innerHTML = '';
      return;
    }
    
    // Check if input is direct coordinates using the enhanced function
    const coords = extractCoordinates(locationInput.value);
    if (coords) {
      latitudeInput.value = coords.latitude;
      longitudeInput.value = coords.longitude;
      suggestions.innerHTML = '';
      
      const coordLocation = `Coordinates: ${coords.latitude},${coords.longitude}`;
      
      // Save coordinates when pasted directly
      saveSettings({
        latitude: coords.latitude,
        longitude: coords.longitude,
        location: coordLocation
      });
      
      // Update placeholder to show used coordinates
      locationInput.placeholder = coordLocation;
      
      return;
    }
    
    // Otherwise search Google Places API using the original extension's URL format
    fetchLocationSuggestions(locationInput.value);
  }, 250));
  
  // Handle Enter key in location input for direct coordinate entry
  locationInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const coords = extractCoordinates(locationInput.value);
      if (coords) {
        latitudeInput.value = coords.latitude;
        longitudeInput.value = coords.longitude;
        
        const coordLocation = `Coordinates: ${coords.latitude},${coords.longitude}`;
        
        // Apply the coordinates
        saveSettings({
          latitude: coords.latitude,
          longitude: coords.longitude,
          location: coordLocation
        });
        
        // Update placeholder to show used coordinates
        locationInput.placeholder = coordLocation;
        
        // Clear input and suggestions
        locationInput.value = '';
        e.preventDefault();
      }
    }
  });
  
  // Enable toggle event listener
  enableToggle.addEventListener('change', function() {
    saveSettings({enabled: this.checked});
    updateStatusText(this.checked);
  });
  
  // Options link event listener
  optionsLink.addEventListener('click', function(e) {
    e.preventDefault();
    const isVisible = businessNumberingSection.style.display !== 'none';
    businessNumberingSection.style.display = isVisible ? 'none' : 'block';
    optionsLink.textContent = isVisible ? 'Options' : 'Hide Options';
    
    // Adjust body height based on options visibility
    const body = document.body;
    if (isVisible) {
      // Collapsing - reduce height
      body.style.height = '480px';
    } else {
      // Expanding - increase height
      body.style.height = '580px';
    }
  });

  // Business Numbering toggle event listener
  businessNumberingToggle.addEventListener('change', function() {
    chrome.storage.sync.set({businessNumberingEnabled: this.checked});
    updateBusinessNumberingStatus(this.checked);
    
    // Send message to content script to enable/disable numbering
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('google.com/maps')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleBusinessNumbering',
          enabled: this.checked
        });
      }
    }.bind(this));
  });
  
  // Coordinate inputs event listeners
  latitudeInput.addEventListener('change', function() {
    saveSettings({latitude: parseFloat(this.value)});
  });
  
  longitudeInput.addEventListener('change', function() {
    saveSettings({longitude: parseFloat(this.value)});
  });
  
  // Reset button event listener
  resetButton.addEventListener('click', function() {
    saveSettings({enabled: false});
    enableToggle.checked = false;
    updateStatusText(false);
    
    // Reset Business Numbering to enabled (default)
    chrome.storage.sync.set({businessNumberingEnabled: true});
    businessNumberingToggle.checked = true;
    updateBusinessNumberingStatus(true);
    
    alert('Location data has been reset. Your searches should now use your actual location.');
  });
  
  // Helper functions
  function fetchLocationSuggestions(query) {
    console.log("Fetching location suggestions for:", query);
    const url = `https://www.google.com/s?tbm=map&suggest=p&gs_ri=maps&gl=US&hl=en&authuser=0&q=${encodeURIComponent(query)}&ech=6&pb=%212i5%214m12%211m3%211d94818581.28087418%212d-20.23133860264248%213d42.377446969366396%212m3%211f0%212f0%213f0%213m2%211i791%212i754%214f13.1%217i20%2110b1%2112m16%211m1%2118b1%212m3%215m1%216e2%2120e3%2110b1%2112b1%2113b1%2116b1%2117m1%213e1%2120m3%215e2%216b1%2114b1%2119m4%212m3%211i360%212i120%214i8%2120m57%212m2%211i203%212i100%213m2%212i4%215b1%216m6%211m2%211i86%212i86%211m2%211i408%212i240%217m42%211m3%211e1%212b0%213e3%211m3%211e2%212b1%213e2%211m3%211e2%212b0%213e3%211m3%211e8%212b0%213e3%211m3%211e10%212b0%213e3%211m3%211e10%212b1%213e2%211m3%211e9%212b1%213e2%211m3%211e10%212b0%213e3%211m3%211e10%212b1%213e2%211m3%211e10%212b0%213e4%212b1%214b1%219b0%2122m3%211sAsuuZfP-HeT-7_UPpJ6DwAQ%217e81%2117sAsuuZfP-HeT-7_UPpJ6DwAQ%3A64%2123m3%211e116%214b1%2110b1%2124m90%211m29%2113m9%212b1%213b1%214b1%216i1%218b1%219b1%2114b1%2120b1%2125b1%2118m18%213b1%214b1%215b1%216b1%219b1%2112b1%2113b1%2114b1%2115b1%2117b1%2120b1%2121b1%2122b1%2125b1%2127m1%211b0%2128b0%2131b0%2110m1%218e3%2111m1%213e1%2114m1%213b1%2117b1%2120m2%211e3%211e6%2124b1%2125b1%2126b1%2129b1%2130m1%212b1%2136b1%2139m3%212m2%212i1%213i1%2143b1%2152b1%2154m1%211b1%2155b1%2156m2%211b1%213b1%2165m5%213m4%211m3%211m2%211i224%212i298%2171b1%2172m17%211m5%211b1%212b1%213b1%215b1%217b1%214b1%218m8%211m6%214m1%211e1%214m1%211e3%214m1%211e4%213sother_user_reviews%219b1%2189b1%21103b1%21113b1%21117b1%21122m1%211b1%2126m4%212m3%211i80%212i92%214i8%2134m18%212b1%213b1%214b1%216b1%218m6%211b1%213b1%214b1%215b1%216b1%217b1%219b1%2112b1%2114b1%2120b1%2123b1%2125b1%2126b1%2137m1%211e81%2147m0%2149m7%213b1%216m2%211b1%212b1%217m2%211e3%212b1%2161b1%2167m2%217b1%2110b1%2169i678`;
    
    // Show loading indicator
    suggestions.innerHTML = '<div class="suggestion-item">Loading suggestions...</div>';
    
    // Use fetch to get the suggestions
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.status}`);
        }
        return response.text();
      })
      .then(data => {
        console.log("Got response data length:", data.length);
        
        // Parse the response
        const lines = data.split('\n');
        console.log("Number of lines:", lines.length);
        
        if (lines.length !== 2) {
          console.log("Unexpected response format, lines:", lines);
          suggestions.innerHTML = '<div class="suggestion-item">No suggestions found</div>';
          return;
        }
        
        let suggests;
        try {
          const result = JSON.parse(lines[1]);
          suggests = result?.[0]?.[1];
          
          if (!suggests || suggests.length === 0) {
            console.log("No suggestions found in response");
            suggestions.innerHTML = '<div class="suggestion-item">No suggestions found</div>';
            return;
          }
          
          console.log("Found suggestions:", suggests.length);
        } catch (e) {
          console.error('Error parsing JSON response:', e);
          suggestions.innerHTML = '<div class="suggestion-item">Error loading suggestions</div>';
          return;
        }
        
        // Filter and map the suggestions
        const locations = suggests
          .filter(item => {
            // Check if the item has the necessary properties
            const hasProperties = (item?.[22]?.[37] != 2) && (item?.[22]?.[11]);
            return hasProperties;
          })
          .map(location => {
            // Extract the data from each location
            return {
              latitude: parseFloat(location?.[22]?.[11]?.[2]),
              longitude: parseFloat(location?.[22]?.[11]?.[3]),
              location: location?.[22]?.[14]?.[0],
              name: location?.[22]?.[14]?.[0],
              placeId: location?.[22]?.[0]?.[27]
            };
          });
        
        console.log("Processed locations:", locations.length);
        
        // Create dropdown with results
        suggestions.innerHTML = '';
        
        if (locations.length === 0) {
          suggestions.innerHTML = '<div class="suggestion-item">No suggestions found</div>';
          return;
        }
        
        locations.forEach(place => {
          const item = document.createElement('div');
          item.className = 'suggestion-item';
          
          // Google format for locations varies, but we can improve the display
          const locationText = place.location || '';
          
          // Create a styled location display with business name and address
          const nameDiv = document.createElement('div');
          nameDiv.className = 'business-name';
          nameDiv.style.fontWeight = 'bold';
          nameDiv.style.marginBottom = '3px';
          
          const addressDiv = document.createElement('div');
          addressDiv.className = 'business-address';
          addressDiv.style.fontSize = '12px';
          addressDiv.style.color = '#666';
          
          // Try to split intelligently between business name and address
          const splitIndex = locationText.indexOf(',');
          
          if (splitIndex > 0 && splitIndex < 60) { // reasonable business name length
            nameDiv.textContent = locationText.substring(0, splitIndex).trim();
            addressDiv.textContent = locationText.substring(splitIndex + 1).trim();
          } else {
            // If can't detect a clear split, use the whole text as the name
            nameDiv.textContent = locationText;
            addressDiv.textContent = '';
          }
          
          // Clear and append the formatted elements
          item.innerHTML = '';
          item.appendChild(nameDiv);
          
          // Only append address div if there's content
          if (addressDiv.textContent) {
            item.appendChild(addressDiv);
          }
          
          item.addEventListener('click', function() {
            latitudeInput.value = place.latitude;
            longitudeInput.value = place.longitude;
            locationInput.placeholder = place.location;
            locationInput.value = '';
            suggestions.innerHTML = '';
            
            saveSettings({
              latitude: place.latitude,
              longitude: place.longitude,
              location: place.location
            });
          });
          suggestions.appendChild(item);
        });
      })
      .catch(error => {
        console.error('Error fetching suggestions:', error.message);
        suggestions.innerHTML = '<div class="suggestion-item">Error loading suggestions</div>';
      });
  }
  
  function saveSettings(updates) {
    chrome.storage.sync.get(['geoSettings'], function(result) {
      const settings = result.geoSettings || {
        enabled: false,
        latitude: 40.7580,
        longitude: -73.9855,
        location: "Times Square, New York, NY, USA"
      };
      
      // Update with new values
      const updatedSettings = { ...settings, ...updates };
      
      // Save to storage
      chrome.storage.sync.set({geoSettings: updatedSettings});
    });
  }
  
  function updateStatusText(enabled) {
    statusText.textContent = enabled ? 'Location spoofing enabled' : 'Location spoofing disabled';
    statusText.className = enabled ? 'status-enabled' : 'status-disabled';
  }
  
  function updateBusinessNumberingStatus(enabled) {
    businessNumberingStatus.textContent = enabled ? 'Business numbering enabled' : 'Business numbering disabled';
    businessNumberingStatus.className = enabled ? 'status-enabled' : 'status-disabled';
  }
  
  // Utility function to debounce input
  function debounce(func, wait) {
    let timeout;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }
  
  // Close suggestions when clicking outside
  document.addEventListener('click', function(event) {
    if (event.target !== locationInput && event.target !== suggestions && !suggestions.contains(event.target)) {
      suggestions.innerHTML = '';
    }
  });
});