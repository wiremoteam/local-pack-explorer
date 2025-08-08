// Test script to verify the extension is working
// Run this in the browser console on any page

console.log('Testing extension...');

// Test if the extension is loaded
chrome.runtime.sendMessage({action: 'test-hotkey'}, function(response) {
  if (response && response.success) {
    console.log('✅ Extension is working:', response.message);
  } else {
    console.log('❌ Extension not responding');
  }
});

// Test storage
chrome.storage.sync.get(['geoSettings', 'hotkeySettings'], function(result) {
  console.log('📦 Storage test:', result);
  
  if (result.hotkeySettings) {
    console.log('✅ Hotkey settings found:', result.hotkeySettings);
  } else {
    console.log('❌ No hotkey settings found');
  }
  
  if (result.geoSettings) {
    console.log('✅ Geo settings found:', result.geoSettings);
  } else {
    console.log('❌ No geo settings found');
  }
});

// Test commands
chrome.commands.getAll(function(commands) {
  console.log('⌨️ Available commands:', commands);
  
  const toggleCommand = commands.find(cmd => cmd.name === 'toggle-location-spoofing');
  if (toggleCommand) {
    console.log('✅ Toggle command found:', toggleCommand);
  } else {
    console.log('❌ Toggle command not found');
  }
});
