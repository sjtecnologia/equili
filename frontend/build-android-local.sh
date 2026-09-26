#!/bin/bash
# Build local Android com JDK 21 e cache Gradle em $HOME para evitar erro de lock em /Volumes.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$ROOT_DIR/android"

export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$HOME/.gradle-local-equili}"
PROJECT_CACHE_DIR="${PROJECT_CACHE_DIR:-$HOME/.gradle-project-cache-equili}"

mkdir -p "$GRADLE_USER_HOME" "$PROJECT_CACHE_DIR"

echo "▶ JAVA_HOME: $JAVA_HOME"
echo "▶ GRADLE_USER_HOME: $GRADLE_USER_HOME"
echo "▶ PROJECT_CACHE_DIR: $PROJECT_CACHE_DIR"

echo "▶ Gerando build web e sincronizando Capacitor..."
cd "$ROOT_DIR"
npm run cap:sync

echo "▶ Build Android (assembleDebug)..."
cd "$ANDROID_DIR"
./gradlew --project-cache-dir "$PROJECT_CACHE_DIR" clean assembleDebug

echo "✅ APK debug gerado em: $ANDROID_DIR/app/build/outputs/apk/debug/"
