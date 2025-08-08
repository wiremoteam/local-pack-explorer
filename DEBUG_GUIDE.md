# Hotkey Debugging Guide

## Steps to Test the Hotkey

1. **Load the Extension**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select this folder
   - Make sure the extension is enabled

2. **Check Extension Status**
   - The extension should appear in the list
   - Click on the extension icon to open the popup
   - Check if the hotkey indicator shows "Ctrl+Shift+L"

3. **Test the Hotkey**
   - Press `Ctrl+Shift+L` (or `Cmd+Shift+L` on Mac)
   - You should see a notification
   - The extension icon should change (enabled/disabled)

4. **Check Console for Errors**
   - Open Chrome DevTools (F12)
   - Go to the "Console" tab
   - Look for any error messages
   - Check for the debug messages we added

5. **Verify Hotkey Settings**
   - Open the extension popup
   - Click the settings icon (⚙️)
   - Check if "Enable Hotkey" is checked
   - Verify the key is set to "L" and modifiers are correct

## Common Issues

1. **Hotkey not working**: Check if the extension has the "notifications" permission
2. **No notification**: The hotkey might be disabled in settings
3. **Extension not loading**: Check for syntax errors in the manifest.json

## Debug Messages to Look For

In the console, you should see:
- "Command received: toggle-location-spoofing"
- "Toggle location spoofing command received"
- "Current settings: {...}"
- "Hotkey settings: {...}"
- "Toggling from false to true" (or vice versa)

If you don't see these messages, the hotkey isn't being triggered.
