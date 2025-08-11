#!/usr/bin/env bash
set -euo pipefail

EXT_DIR="/Users/adriancrismaru/Desktop/programming/local-pack-gps"
MANIFEST="$EXT_DIR/manifest.json"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Error: manifest.json not found in $EXT_DIR"
  exit 1
fi

# Read version from manifest.json
VERSION="$(/usr/bin/python3 - <<'PY' "$MANIFEST"
import json,sys
path=sys.argv[1]
d=json.load(open(path))
print(d.get("version","0.0.0"))
PY
)"

if [[ -z "$VERSION" ]]; then
  echo "Error: Could not read version from manifest.json"
  exit 1
fi

# Temp build folder
BUILD_DIR="${EXT_DIR}_build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

echo "• Copying extension files (excluding junk)..."
rsync -a "$EXT_DIR"/ "$BUILD_DIR"/ \
  --delete \
  --exclude ".git/" \
  --exclude ".github/" \
  --exclude ".gitignore" \
  --exclude ".gitattributes" \
  --exclude ".DS_Store" \
  --exclude "__MACOSX/" \
  --exclude "Thumbs.db" \
  --exclude "._*" \
  --exclude ".idea/" \
  --exclude ".vscode/" \
  --exclude "node_modules/" \
  --exclude "coverage/" \
  --exclude "tests/" \
  --exclude "test/" \
  --exclude ".cache/" \
  --exclude "*.log" \
  --exclude "*.tgz" \
  --exclude "*.zip"

# Create zip in same folder as extension
ZIP_NAME="$(basename "$EXT_DIR")-$VERSION.zip"
ZIP_PATH="$(dirname "$EXT_DIR")/$ZIP_NAME"

echo "• Creating ZIP: $ZIP_PATH"
export COPYFILE_DISABLE=1
(
  cd "$BUILD_DIR"
  zip -r -9 -X "$ZIP_PATH" . \
    -x "*.DS_Store" -x "__MACOSX/*" -x "._*"
)

# Cleanup
rm -rf "$BUILD_DIR"

echo "• Done!"
echo "ZIP created at: $ZIP_PATH"

