# Local Pack Explorer Chrome Extension

Professional location spoofing tool for Google Maps and Google Search. Local SEO Tools.

## Features

- **Location Spoofing**: Override browser geolocation for Google services
- **Maps Result Numbering**: Automatically number Google Maps search results
- **SERP Result Numbering**: Number Google Search Engine Results Page (SERP) results
- **Ad Numbering**: Number sponsored ads with orange badges (1, 2, 3...) using same design as regular numbers
- **Ad Statistics**: Display real-time ad count statistics (top ads, bottom ads, total, organic results)
- **Search Console Context Menu**: Right-click to copy keywords from Google Search Console tables
- **Professional UI**: Clean, intuitive interface for developers and SEO professionals
- **Real-time Toggle**: Enable/disable features instantly
- **Precise Coordinates**: Enter exact latitude/longitude or use preset locations

## Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder

## Usage

### Location Spoofing
1. Click the extension icon
2. Toggle "Location Spoofing" to enable
3. Enter coordinates or use preset locations
4. Visit Google Maps or Google Search to see location-specific results

### Maps Result Numbering
1. Navigate to Google Maps search results
2. Toggle "Maps Result Numbering" in the extension popup
3. Business listings will be automatically numbered

### SERP Result Numbering
1. Navigate to Google Search Engine Results Page (SERP)
2. Toggle "SERP Result Numbering" in the extension popup
3. Organic search results will be numbered with blue badges (#1, #2, #3...)
4. Sponsored ads will be numbered with orange badges (1, 2, 3...)
5. Ad statistics will be displayed in a fixed position box

### Search Console Context Menu
1. Navigate to Google Search Console (https://search.google.com/search-console/)
2. Go to any page with keyword tables (Performance report, etc.)
3. Right-click on any keyword row
4. Select "Copy: [keyword]" from the context menu
5. The keyword will be copied to your clipboard
6. Visual feedback shows the copied keyword

## File Structure

```
local-pack-gps/
├── manifest.json          # Extension manifest
├── background.js          # Background script for header modification
├── maps_counter.js        # Content script for Maps Result numbering
├── serp_counter.js        # Content script for SERP Result numbering
├── search_console_context.js # Content script for Search Console context menu
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── test_search_console.html # Test page for Search Console functionality
├── img/                  # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

## Development

### Prerequisites
- Google Chrome browser
- Basic knowledge of Chrome extensions

### Building
No build process required - this is a vanilla JavaScript extension.

### Testing
1. Load the extension in Chrome
2. Test location spoofing on Google Maps
3. Test Maps Result numbering on Google Maps search results
4. Test SERP Result numbering on Google Search results
5. Test Ad numbering on sponsored content
6. Test Search Console context menu using `test_search_console.html`
7. Verify popup functionality
8. Use `test_ad_numbering.html` to test ad numbering functionality

## Permissions

- `storage`: Save user preferences
- `declarativeNetRequest`: Modify HTTP headers for location spoofing
- Host permissions: `*://*.google.com/*`, `*://labs.google/*`

## Privacy

- No user data is collected or transmitted
- All preferences stored locally using chrome.storage.sync
- No remote code execution
- Only modifies headers for Google services

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions, please open an issue on GitHub.
