// Simple test to verify hotkey functionality
// Run this in the browser console

console.log('🧪 Testing hotkey functionality...');

// Test 1: Check if extension responds
chrome.runtime.sendMessage({action: 'test-hotkey'}, function(response) {
  if (response && response.success) {
    console.log('✅ Extension communication working');
    
    // Test 2: Test the actual hotkey function
    chrome.runtime.sendMessage({action: 'test-hotkey-function'}, function(response2) {
      if (response2 && response2.success) {
        console.log('✅ Hotkey function tested successfully');
        console.log('🎯 Now try pressing Ctrl+Shift+L (or Cmd+Shift+L on Mac)');
      } else {
        console.log('❌ Hotkey function test failed');
      }
    });
  } else {
    console.log('❌ Extension not responding');
  }
});

// Test 3: Manual command execution
console.log('🔧 Testing manual command execution...');
chrome.commands.executeCommand('toggle-location-spoofing', function(result) {
  if (chrome.runtime.lastError) {
    console.log('❌ Command execution failed:', chrome.runtime.lastError);
  } else {
    console.log('✅ Command executed successfully');
  }
});
