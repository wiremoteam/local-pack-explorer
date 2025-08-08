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
  
  // Modal elements
  const saveLocationBtn = document.getElementById('save-location-btn');
  const saveLocationModal = document.getElementById('save-location-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  let locationNameInput = document.getElementById('location-name-input');
  let previewCoordinates = document.getElementById('preview-coordinates');
  let previewLocation = document.getElementById('preview-location');
  const cancelSaveBtn = document.getElementById('cancel-save-btn');
  const confirmSaveBtn = document.getElementById('confirm-save-btn');
  
  // Load saved settings
  chrome.storage.sync.get(['geoSettings', 'businessNumberingEnabled', 'savedLocations'], function(result) {
    const settings = result.geoSettings || {
      enabled: false,
      latitude: 40.7580,
      longitude: -73.9855,
      location: "Times Square, New York, NY, USA"
    };
    
    const businessNumberingEnabled = result.businessNumberingEnabled !== undefined ? result.businessNumberingEnabled : true;
    const savedLocations = result.savedLocations || [];
    
    // Update UI with saved settings
    latitudeInput.value = settings.latitude;
    longitudeInput.value = settings.longitude;
    locationInput.placeholder = settings.location || "Enter a location or lat,lng";
    enableToggle.checked = settings.enabled;
    businessNumberingToggleModal.checked = businessNumberingEnabled;
    updateStatusText(settings.enabled);
    updateBusinessNumberingStatusModal(businessNumberingEnabled);
    
    // Display saved locations (we'll implement this in Step 4)
    displaySavedLocations(savedLocations);
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
    // Clear active state when user starts typing (searching for different location)
    if (locationInput.value.length > 0) {
      // Clear the current active location by setting coordinates to 0
      latitudeInput.value = '';
      longitudeInput.value = '';
    }
    
    // Refresh chips to update highlighting
    chrome.storage.sync.get(['savedLocations'], function(result) {
      const savedLocations = result.savedLocations || [];
      displaySavedLocations(savedLocations);
    });
    
    if (locationInput.value.length < 2) {
      suggestions.innerHTML = '';
      suggestions.style.display = 'none';
      return;
    }
    
    // Check if input is direct coordinates using the enhanced function
    const coords = extractCoordinates(locationInput.value);
    if (coords) {
      latitudeInput.value = coords.latitude;
      longitudeInput.value = coords.longitude;
      suggestions.innerHTML = '';
      suggestions.style.display = 'none';
      
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
      suggestions.style.display = 'none';
      e.preventDefault();
      }
    }
  });
  
  // Enable toggle event listener
  enableToggle.addEventListener('change', function() {
    saveSettings({enabled: this.checked});
    updateStatusText(this.checked);
  });
  
  // Options icon event listener
  const optionsIconBtn = document.getElementById('options-icon-btn');
  const optionsModal = document.getElementById('options-modal');
  const closeOptionsModalBtn = document.getElementById('close-options-modal-btn');
  const businessNumberingToggleModal = document.getElementById('business-numbering-toggle-modal');
  const businessNumberingStatusModal = document.getElementById('business-numbering-status-modal');
  
  optionsIconBtn.addEventListener('click', function(e) {
    e.preventDefault();
    optionsModal.style.display = 'flex';
  });
  
  closeOptionsModalBtn.addEventListener('click', function() {
    optionsModal.style.display = 'none';
  });
  
  // Close options modal with Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && optionsModal.style.display === 'flex') {
      optionsModal.style.display = 'none';
    }
  });
  

  


  // Maps Result Numbering toggle event listener (modal version)
  businessNumberingToggleModal.addEventListener('change', function() {
    chrome.storage.sync.set({businessNumberingEnabled: this.checked});
    updateBusinessNumberingStatusModal(this.checked);
    
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
    const value = parseFloat(this.value);
    if (!isNaN(value)) {
      this.value = value.toFixed(7);
      saveSettings({latitude: value});
    }
  });
  
  longitudeInput.addEventListener('change', function() {
    const value = parseFloat(this.value);
    if (!isNaN(value)) {
      this.value = value.toFixed(7);
      saveSettings({longitude: value});
    }
  });
  
  // Reset button event listener
  resetButton.addEventListener('click', function() {
    saveSettings({enabled: false});
    enableToggle.checked = false;
    updateStatusText(false);
    
    // Reset Maps Result Numbering to enabled (default)
    chrome.storage.sync.set({businessNumberingEnabled: true});
    businessNumberingToggle.checked = true;
    updateBusinessNumberingStatus(true);
    
    alert('Location data has been reset. Your searches should now use your actual location.');
  });
  
  // Save Location Modal functionality
  saveLocationBtn.addEventListener('click', function() {
    // Update preview with current values
    const currentLat = parseFloat(latitudeInput.value) || 0;
    const currentLng = parseFloat(longitudeInput.value) || 0;
    const currentLocation = locationInput.placeholder || 'Unknown location';
    
    previewCoordinates.textContent = `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;
    previewLocation.textContent = currentLocation;
    
    // Pre-fill the name input with the current location name
    locationNameInput.value = currentLocation;
    
    // Show the modal
    saveLocationModal.style.display = 'flex';
    
    // Focus on the name input and select all text for easy editing
    setTimeout(() => {
      locationNameInput.focus();
      locationNameInput.select();
    }, 100);
  });
  
  // Close modal functions
  function closeModal() {
    saveLocationModal.style.display = 'none';
    locationNameInput.value = '';
    
    // Reset modal content back to original form
    const modalBody = document.querySelector('.modal-body');
    const modalFooter = document.querySelector('.modal-footer');
    
    modalBody.innerHTML = `
      <div class="form-group">
        <label for="location-name-input">Location Name:</label>
        <input type="text" id="location-name-input" class="modal-input" placeholder="Enter a name for this location" maxlength="50">
      </div>
      <div class="location-preview">
        <div class="preview-item">
          <span class="preview-label">Coordinates:</span>
          <span id="preview-coordinates" class="preview-value">40.7580, -73.9855</span>
        </div>
        <div class="preview-item">
          <span class="preview-label">Location:</span>
          <span id="preview-location" class="preview-value">Times Square, New York, NY, USA</span>
        </div>
      </div>
    `;
    
    // Show the footer buttons again
    modalFooter.style.display = 'flex';
    
    // Re-attach the input element reference
    locationNameInput = document.getElementById('location-name-input');
    
    // Re-attach the preview element references
    previewCoordinates = document.getElementById('preview-coordinates');
    previewLocation = document.getElementById('preview-location');
  }
  
  closeModalBtn.addEventListener('click', closeModal);
  cancelSaveBtn.addEventListener('click', closeModal);
  
  // Close modal with Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && saveLocationModal.style.display === 'flex') {
      closeModal();
    }
  });
  
  // Confirm save button functionality
  confirmSaveBtn.addEventListener('click', function() {
    const locationName = locationNameInput.value.trim();
    
    if (!locationName) {
      alert('Please enter a name for this location.');
      locationNameInput.focus();
      return;
    }
    
    // Get current location data
    const currentLat = parseFloat(latitudeInput.value) || 0;
    const currentLng = parseFloat(longitudeInput.value) || 0;
    const currentLocation = locationInput.placeholder || 'Unknown location';
    
    // Check for duplicates before saving
    checkAndSaveLocation(locationName, currentLat, currentLng, currentLocation);
  });
  
  // Function to show save success message
  function showSaveSuccess() {
    // Hide the form and show success message
    const modalBody = document.querySelector('.modal-body');
    const modalFooter = document.querySelector('.modal-footer');
    
    modalBody.innerHTML = `
      <div class="save-success">
        <div class="success-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#10b981" stroke-width="2"/>
            <path d="M9 12l2 2 4-4" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h4>Location Saved!</h4>
        <p>The location has been saved successfully.</p>
      </div>
    `;
    
    // Hide the footer buttons
    modalFooter.style.display = 'none';
  }
  
  // Function to show "location already exists" message
  function showLocationExistsMessage() {
    // Hide the form and show "already exists" message
    const modalBody = document.querySelector('.modal-body');
    const modalFooter = document.querySelector('.modal-footer');
    
    modalBody.innerHTML = `
      <div class="save-success">
        <div class="success-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#f59e0b" stroke-width="2"/>
            <path d="M12 8v4M12 16h.01" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h4>Location Already Exists</h4>
        <p>This location has already been saved.</p>
      </div>
    `;
    
    // Hide the footer buttons
    modalFooter.style.display = 'none';
  }
  
  // Helper functions
  function fetchLocationSuggestions(query) {

    const url = `https://www.google.com/s?tbm=map&suggest=p&gs_ri=maps&gl=US&hl=en&authuser=0&q=${encodeURIComponent(query)}&ech=6&pb=%212i5%214m12%211m3%211d94818581.28087418%212d-20.23133860264248%213d42.377446969366396%212m3%211f0%212f0%213f0%213m2%211i791%212i754%214f13.1%217i20%2110b1%2112m16%211m1%2118b1%212m3%215m1%216e2%2120e3%2110b1%2112b1%2113b1%2116b1%2117m1%213e1%2120m3%215e2%216b1%2114b1%2119m4%212m3%211i360%212i120%214i8%2120m57%212m2%211i203%212i100%213m2%212i4%215b1%216m6%211m2%211i86%212i86%211m2%211i408%212i240%217m42%211m3%211e1%212b0%213e3%211m3%211e2%212b1%213e2%211m3%211e2%212b0%213e3%211m3%211e8%212b0%213e3%211m3%211e10%212b0%213e3%211m3%211e10%212b1%213e2%211m3%211e9%212b1%213e2%211m3%211e10%212b0%213e3%211m3%211e10%212b1%213e2%211m3%211e10%212b0%213e4%212b1%214b1%219b0%2122m3%211sAsuuZfP-HeT-7_UPpJ6DwAQ%217e81%2117sAsuuZfP-HeT-7_UPpJ6DwAQ%3A64%2123m3%211e116%214b1%2110b1%2124m90%211m29%2113m9%212b1%213b1%214b1%216i1%218b1%219b1%2114b1%2120b1%2125b1%2118m18%213b1%214b1%215b1%216b1%219b1%2112b1%2113b1%2114b1%2115b1%2117b1%2120b1%2121b1%2122b1%2125b1%2127m1%211b0%2128b0%2131b0%2110m1%218e3%2111m1%213e1%2114m1%213b1%2117b1%2120m2%211e3%211e6%2124b1%2125b1%2126b1%2129b1%2130m1%212b1%2136b1%2139m3%212m2%212i1%213i1%2143b1%2152b1%2154m1%211b1%2155b1%2156m2%211b1%213b1%2165m5%213m4%211m3%211m2%211i224%212i298%2171b1%2172m17%211m5%211b1%212b1%213b1%215b1%217b1%214b1%218m8%211m6%214m1%211e1%214m1%211e3%214m1%211e4%213sother_user_reviews%219b1%2189b1%21103b1%21113b1%21117b1%21122m1%211b1%2126m4%212m3%211i80%212i92%214i8%2134m18%212b1%213b1%214b1%216b1%218m6%211b1%213b1%214b1%215b1%216b1%217b1%219b1%2112b1%2114b1%2120b1%2123b1%2125b1%2126b1%2137m1%211e81%2147m0%2149m7%213b1%216m2%211b1%212b1%217m2%211e3%212b1%2161b1%2167m2%217b1%2110b1%2169i678`;
    
    // Show loading indicator
    suggestions.style.display = 'block';
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

        
        // Parse the response
        const lines = data.split('\n');
        
        
        if (lines.length !== 2) {
          
          suggestions.innerHTML = '<div class="suggestion-item">No suggestions found</div>';
          return;
        }
        
        let suggests;
        try {
          const result = JSON.parse(lines[1]);
          suggests = result?.[0]?.[1];
          
          if (!suggests || suggests.length === 0) {
  
            suggestions.innerHTML = '<div class="suggestion-item">No suggestions found</div>';
            return;
          }
          

        } catch (e) {
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
            suggestions.style.display = 'none';
            
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
          businessNumberingStatus.textContent = enabled ? 'Maps Result numbering enabled' : 'Maps Result numbering disabled';
    businessNumberingStatus.className = enabled ? 'status-enabled' : 'status-disabled';
  }
  
  function updateBusinessNumberingStatusModal(enabled) {
          businessNumberingStatusModal.textContent = enabled ? 'Maps Result numbering enabled' : 'Maps Result numbering disabled';
    businessNumberingStatusModal.className = enabled ? 'status-enabled' : 'status-disabled';
  }
  
  // Dynamic height adjustment function
  function adjustBodyHeight() {
    const body = document.body;
    const container = document.querySelector('.container');
    
    // Get the natural height of the container
    const naturalHeight = container.scrollHeight;
    
    // Calculate the new body height with some padding
    const newHeight = Math.min(naturalHeight + 32, 600); // Max 600px, add 32px padding
    
    // Apply the new height with smooth transition
    body.style.height = newHeight + 'px';
    
    
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
  
  // Check for duplicates and save location
  function checkAndSaveLocation(name, latitude, longitude, location) {
    chrome.storage.sync.get(['savedLocations'], function(result) {
      const savedLocations = result.savedLocations || [];
      
      // Check if location with same coordinates already exists
      const existingByCoordinates = savedLocations.findIndex(loc => 
        Math.abs(loc.latitude - latitude) < 0.000001 && 
        Math.abs(loc.longitude - longitude) < 0.000001
      );
      
      // Check if location with this name already exists
      const existingByName = savedLocations.findIndex(loc => loc.name === name);
      
      if (existingByCoordinates !== -1) {
        // Location with same coordinates already exists
        const existingLocation = savedLocations[existingByCoordinates];
        if (existingLocation.name === name) {
          // Same name and coordinates - just update timestamp
          savedLocations[existingByCoordinates] = {
            ...existingLocation,
            timestamp: Date.now()
          };
          
          // Show "already exists" message
          showLocationExistsMessage();
          
          // Close modal after 5 seconds for error case
          setTimeout(() => {
            closeModal();
          }, 3000);
        } else {
          // Same coordinates but different name - ask user
          if (confirm(`A location with these coordinates already exists as "${existingLocation.name}". Do you want to save this as a new location with the name "${name}"?`)) {
            savedLocations.push({
              name: name,
              latitude: latitude,
              longitude: longitude,
              location: location,
              timestamp: Date.now()
            });
            
            // Save and show success
            saveToStorageAndShowSuccess(savedLocations, name);
          } else {
            // User cancelled - do nothing, keep modal open

            return;
          }
        }
      } else if (existingByName !== -1) {
        // Same name but different coordinates - update existing
        savedLocations[existingByName] = {
          name: name,
          latitude: latitude,
          longitude: longitude,
          location: location,
          timestamp: Date.now()
        };
        
        // Save and show success
        saveToStorageAndShowSuccess(savedLocations, name);
      } else {
        // New location - add it
        savedLocations.push({
          name: name,
          latitude: latitude,
          longitude: longitude,
          location: location,
          timestamp: Date.now()
        });
        
        // Save and show success
        saveToStorageAndShowSuccess(savedLocations, name);
      }
    });
  }
  
  // Save to storage and show success message
  function saveToStorageAndShowSuccess(savedLocations, name) {
    chrome.storage.sync.set({savedLocations: savedLocations}, function() {
      
      // Refresh the saved locations display
      displaySavedLocations(savedLocations);
      
      // Show success message in modal
      showSaveSuccess();
      
      // Close modal after 1.5 seconds
      setTimeout(() => {
        closeModal();
      }, 1500);
    });
  }
  
  // Save location to Chrome storage (legacy function - kept for compatibility)
  function saveLocationToStorage(name, latitude, longitude, location) {
    checkAndSaveLocation(name, latitude, longitude, location);
  }
  
  // Display saved locations
  function displaySavedLocations(locations) {
    const savedLocationsChips = document.getElementById('saved-locations-chips');
    
    // Show/hide chips based on whether there are saved locations
    if (locations.length > 0) {
      savedLocationsChips.style.display = 'flex';
      
      // Clear existing chips
      savedLocationsChips.innerHTML = '';
      
      // Sort locations by timestamp (newest first)
      const sortedLocations = [...locations].sort((a, b) => {
        const timestampA = a.timestamp || 0;
        const timestampB = b.timestamp || 0;
        return timestampB - timestampA;
      });
      
      // Create chips for each saved location
      sortedLocations.forEach((location, index) => {
        const chip = createLocationChip(location, index);
        savedLocationsChips.appendChild(chip);
      });
    } else {
      savedLocationsChips.style.display = 'none';
    }
  }
  

  
  // Create a location chip element
  function createLocationChip(location, index) {
    const chip = document.createElement('div');
    chip.className = 'location-chip';
    chip.dataset.index = index;
    
    // Check if this location is currently active
    const currentLat = parseFloat(latitudeInput.value) || 0;
    const currentLng = parseFloat(longitudeInput.value) || 0;
    const isActive = Math.abs(location.latitude - currentLat) < 0.000001 && 
                     Math.abs(location.longitude - currentLng) < 0.000001;
    
    // Check if search input exactly matches this chip
    const searchInput = locationInput.value.toLowerCase().trim();
    const chipName = location.name.toLowerCase();
    const isHighlighted = searchInput && searchInput === chipName;
    
    // Apply styling with priority: active > highlight > normal
    if (isActive) {
      chip.classList.add('active');
    } else if (isHighlighted) {
      chip.classList.add('highlight');
    }
    
    chip.innerHTML = `
      <span class="chip-name">${location.name}</span>
      <button class="delete-btn" title="Delete this location">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 18L18 6M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;
    
    // Add event listeners
    const deleteBtn = chip.querySelector('.delete-btn');
    
    // Load location when chip is clicked (but not on delete button)
    chip.addEventListener('click', function(e) {
      if (!e.target.closest('.delete-btn')) {
        loadLocation(location);
      }
    });
    
    // Delete button click
    deleteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteLocation(location);
    });
    
    return chip;
  }
  
  // Load a saved location
  function loadLocation(location) {
    // Update the input fields with proper decimal places
    latitudeInput.value = parseFloat(location.latitude).toFixed(7);
    longitudeInput.value = parseFloat(location.longitude).toFixed(7);
    locationInput.placeholder = location.location;
    
    // Enable location spoofing and save the settings
    saveSettings({
      latitude: location.latitude,
      longitude: location.longitude,
      location: location.location,
      enabled: true
    });
    
    // Update the UI to reflect enabled state
    enableToggle.checked = true;
    updateStatusText(true);
    
    // Update the display to show which location is active
    chrome.storage.sync.get(['savedLocations'], function(result) {
      const savedLocations = result.savedLocations || [];
      displaySavedLocations(savedLocations);
    });
    
    
  }
  
  // Delete a saved location
  function deleteLocation(locationToDelete) {
    if (confirm('Are you sure you want to delete this saved location?')) {
      chrome.storage.sync.get(['savedLocations'], function(result) {
        const savedLocations = result.savedLocations || [];
        
        // Find the location by matching coordinates and name
        const indexToDelete = savedLocations.findIndex(loc => 
          Math.abs(loc.latitude - locationToDelete.latitude) < 0.000001 && 
          Math.abs(loc.longitude - locationToDelete.longitude) < 0.000001 &&
          loc.name === locationToDelete.name
        );
        
        if (indexToDelete !== -1) {
          savedLocations.splice(indexToDelete, 1);
          
          chrome.storage.sync.set({savedLocations: savedLocations}, function() {
  
            displaySavedLocations(savedLocations);
          });
        }
      });
    }
  }
  
  // Close suggestions when clicking outside
  document.addEventListener('click', function(event) {
    if (event.target !== locationInput && event.target !== suggestions && !suggestions.contains(event.target)) {
      suggestions.innerHTML = '';
    }
  });
});