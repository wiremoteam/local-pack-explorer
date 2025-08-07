# Local Pack Explorer Chrome Extension

Professional location spoofing tool for Google Maps and Google Search. Local SEO Tools.

## Features

- **Location Spoofing**: Override browser geolocation for Google services
- **Business Numbering**: Automatically number Google Maps business listings
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

### Business Numbering
1. Navigate to Google Maps search results
2. Toggle "Business Numbering" in the extension popup
3. Business listings will be automatically numbered

## File Structure

```
local-pack-gps/
├── manifest.json          # Extension manifest
├── background.js          # Background script for header modification
├── maps_counter.js        # Content script for business numbering
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
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
3. Test business numbering on Google Maps search results
4. Verify popup functionality

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
