#!/bin/bash

# Extension packaging script for Chrome Web Store
# This script creates a clean zip file for the extension

echo "🚀 Creating extension package..."

# Set variables
EXTENSION_NAME="local-pack-gps"
VERSION=$(grep '"version"' manifest.json | cut -d'"' -f4)
PACKAGE_NAME="${EXTENSION_NAME}-v${VERSION}.zip"

echo "📦 Extension version: $VERSION"
echo "📁 Package name: $PACKAGE_NAME"

# Remove existing package if it exists
if [ -f "$PACKAGE_NAME" ]; then
    echo "🗑️  Removing existing package: $PACKAGE_NAME"
    rm "$PACKAGE_NAME"
fi

# Create the zip package
echo "📦 Creating zip package..."

# Files to include in the package
zip "$PACKAGE_NAME" \
    manifest.json \
    background.js \
    popup.html \
    popup.js \
    serp_counter.js \
    maps_counter.js \
    search_console_context.js \
    gtrack_coordinates.js \
    feedback_system.js \
    gtrack-styles.css \
    img/icon16.png \
    img/icon48.png \
    img/icon128.png \
    img/enabled.png \
    img/disabled.png

# Check if zip was created successfully
if [ -f "$PACKAGE_NAME" ]; then
    echo "✅ Package created successfully: $PACKAGE_NAME"
    echo "📊 Package size: $(du -h "$PACKAGE_NAME" | cut -f1)"
    echo ""
    echo "🎯 Next steps:"
    echo "   1. Upload $PACKAGE_NAME to Chrome Web Store"
    echo "   2. Update version in manifest.json if needed"
    echo "   3. Test the extension thoroughly"
else
    echo "❌ Failed to create package!"
    exit 1
fi

echo "🎉 Extension packaging complete!" 
