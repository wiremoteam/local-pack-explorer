// Test script to verify place data extraction
// This can be run in the browser console to test the extraction logic

// Load the test JSON data
fetch('/t.json')
  .then(response => response.json())
  .then(data => {
    console.log('Loaded test JSON data:', data);
    
    // Test the extraction function
    const extractedData = extractPlaceData(data);
    console.log('Extracted place data:', extractedData);
    
    if (extractedData) {
      console.log('✅ Place data extraction successful!');
      console.log('Business name:', extractedData.name);
      console.log('Address:', extractedData.address);
      console.log('Rating:', extractedData.rating);
      console.log('Review count:', extractedData.reviewCount);
      console.log('Website:', extractedData.website);
      console.log('Coordinates:', extractedData.coordinates);
      console.log('Categories:', extractedData.categories);
      console.log('Phone:', extractedData.phone);
      console.log('Business hours:', extractedData.businessHours);
      console.log('Photos count:', extractedData.photos ? extractedData.photos.length : 0);
      console.log('Description:', extractedData.description);
    } else {
      console.log('❌ Place data extraction failed');
    }
  })
  .catch(error => {
    console.error('Error loading test data:', error);
  });

// Place data extraction function (copied from place_tracker.js)
function extractPlaceData(jsonData) {
    try {
        if (!jsonData || !Array.isArray(jsonData) || jsonData.length < 2) {
            return null;
        }

        const placeInfo = jsonData[1]; // The main place data is usually in index 1
        if (!placeInfo || !Array.isArray(placeInfo)) {
            return null;
        }

        // Extract basic place information
        const placeData = {
            name: null,
            address: null,
            phone: null,
            website: null,
            rating: null,
            reviewCount: null,
            placeId: null,
            coordinates: null,
            businessHours: null,
            categories: null,
            photos: null,
            description: null,
            extractedAt: new Date().toISOString()
        };

        // Based on the t.json example, the structure is:
        // [null, [placeInfo], null, null, [coordinates], null, [mainData]]
        // Let's look for the main data section
        let mainData = null;
        
        // Find the main data section (usually contains the business info)
        for (let i = 0; i < placeInfo.length; i++) {
            const section = placeInfo[i];
            if (Array.isArray(section) && section.length > 0) {
                // Look for a section that contains business name and details
                if (section[0] && Array.isArray(section[0]) && section[0].length > 1) {
                    const firstItem = section[0];
                    // Check if this looks like business data (has name, address, etc.)
                    if (firstItem[1] && typeof firstItem[1] === 'string' && firstItem[1].length > 2) {
                        mainData = section[0];
                        break;
                    }
                }
            }
        }

        if (mainData && Array.isArray(mainData)) {
            // Extract name (usually in index 1)
            if (mainData[1] && typeof mainData[1] === 'string') {
                placeData.name = mainData[1];
            }
            
            // Extract address (usually in index 2)
            if (mainData[2] && Array.isArray(mainData[2])) {
                placeData.address = mainData[2].join(', ');
            }
            
            // Extract rating and review count (usually in index 3)
            if (mainData[3] && Array.isArray(mainData[3])) {
                const ratingInfo = mainData[3];
                if (ratingInfo[0] && Array.isArray(ratingInfo[0])) {
                    placeData.rating = ratingInfo[0][0];
                    placeData.reviewCount = ratingInfo[0][1];
                }
            }
            
            // Extract website (usually in index 4)
            if (mainData[4] && Array.isArray(mainData[4])) {
                placeData.website = mainData[4][0];
            }
            
            // Extract coordinates (usually in index 5)
            if (mainData[5] && Array.isArray(mainData[5])) {
                const coordInfo = mainData[5];
                if (coordInfo[0] && coordInfo[1] && !isNaN(coordInfo[0]) && !isNaN(coordInfo[1])) {
                    placeData.coordinates = {
                        latitude: coordInfo[0],
                        longitude: coordInfo[1]
                    };
                }
            }
            
            // Extract place ID (usually in index 6)
            if (mainData[6] && typeof mainData[6] === 'string') {
                placeData.placeId = mainData[6];
            }
            
            // Extract categories (usually in index 7)
            if (mainData[7] && Array.isArray(mainData[7])) {
                placeData.categories = mainData[7];
            }
        }

        // Look for phone number in the data
        for (let i = 0; i < placeInfo.length; i++) {
            const section = placeInfo[i];
            if (Array.isArray(section)) {
                for (let j = 0; j < section.length; j++) {
                    const item = section[j];
                    if (Array.isArray(item)) {
                        for (let k = 0; k < item.length; k++) {
                            const subItem = item[k];
                            if (typeof subItem === 'string' && subItem.match(/^[\+]?[0-9\s\-\(\)]+$/)) {
                                placeData.phone = subItem;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Extract business hours (look for structured hours data)
        for (let i = 0; i < placeInfo.length; i++) {
            const section = placeInfo[i];
            if (Array.isArray(section) && section.length > 0) {
                // Look for business hours pattern
                if (section[0] && Array.isArray(section[0]) && section[0].length > 0) {
                    const firstItem = section[0][0];
                    if (Array.isArray(firstItem) && firstItem.length > 0) {
                        // Check if this looks like business hours
                        const text = firstItem.join(' ').toLowerCase();
                        if (text.includes('monday') || text.includes('tuesday') || text.includes('wednesday') || 
                            text.includes('thursday') || text.includes('friday') || text.includes('saturday') || 
                            text.includes('sunday') || text.includes('am') || text.includes('pm')) {
                            placeData.businessHours = section[0];
                            break;
                        }
                    }
                }
            }
        }

        // Extract photos (look for photo URLs)
        for (let i = 0; i < placeInfo.length; i++) {
            const section = placeInfo[i];
            if (Array.isArray(section)) {
                for (let j = 0; j < section.length; j++) {
                    const item = section[j];
                    if (Array.isArray(item)) {
                        for (let k = 0; k < item.length; k++) {
                            const subItem = item[k];
                            if (typeof subItem === 'string' && subItem.includes('googleusercontent.com')) {
                                if (!placeData.photos) placeData.photos = [];
                                placeData.photos.push(subItem);
                            }
                        }
                    }
                }
            }
        }

        // Extract description (look for longer text content)
        for (let i = 0; i < placeInfo.length; i++) {
            const section = placeInfo[i];
            if (Array.isArray(section)) {
                for (let j = 0; j < section.length; j++) {
                    const item = section[j];
                    if (Array.isArray(item)) {
                        for (let k = 0; k < item.length; k++) {
                            const subItem = item[k];
                            if (typeof subItem === 'string' && subItem.length > 50 && 
                                !subItem.includes('http') && !subItem.includes('googleusercontent.com')) {
                                placeData.description = subItem;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Only return data if we found at least a name
        if (placeData.name) {
            return placeData;
        }

        return null;
    } catch (error) {
        console.error('[Place Tracker] Error extracting place data:', error);
        return null;
    }
}
