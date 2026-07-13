#!/bin/bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if [ ! -f "./CumulusBubble" ]; then
  echo "CumulusBubble hasn't been built yet. Run ./build.sh first."
  exit 1
fi

APP="Cumulus Bubble.app"
echo "Packaging $APP ..."

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
mkdir -p "$APP/Contents/Resources"

cp "./CumulusBubble" "$APP/Contents/MacOS/CumulusBubble"
chmod +x "$APP/Contents/MacOS/CumulusBubble"

cat > "$APP/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Cumulus Bubble</string>
  <key>CFBundleDisplayName</key><string>Cumulus Bubble</string>
  <key>CFBundleIdentifier</key><string>com.cumulus.bubble</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleExecutable</key><string>CumulusBubble</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><true/>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# quarantine-clear in case this got copied around locally before zipping
xattr -cr "$APP" 2>/dev/null || true

rm -f "Cumulus Bubble.zip"
zip -r -q "Cumulus Bubble.zip" "$APP"

echo "Done! Created:"
echo "  - $APP            (double-click to run, or drag to Applications)"
echo "  - Cumulus Bubble.zip   (this is the file to upload/share on a website)"
