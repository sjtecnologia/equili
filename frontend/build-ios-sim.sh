#!/bin/bash
# Gera build do simulador iOS (não precisa de assinatura)
set -e

PROJECT="/Users/renato/Documents/Developement/equili/frontend/ios/App/App.xcodeproj"
SCHEME="App"
SDK="iphonesimulator"
DEST="platform=iOS Simulator,name=iPhone 15"
OUTPUT="/Users/renato/Documents/Developement/equili/frontend/ios/build"

echo "▶ Resolvendo dependências SPM..."
xcodebuild -project "$PROJECT" \
  -scheme "$SCHEME" \
  -resolvePackageDependencies 2>&1

echo "▶ Buildando para simulador..."
xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -sdk "$SDK" \
  -destination "$DEST" \
  -configuration Debug \
  CONFIGURATION_BUILD_DIR="$OUTPUT" \
  build 2>&1

echo "✅ Build concluído em: $OUTPUT"
ls "$OUTPUT"/*.app 2>/dev/null || true
