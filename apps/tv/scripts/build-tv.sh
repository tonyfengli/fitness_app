#!/bin/bash

# Build script for Android TV app

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "android" ]; then
    echo -e "${RED}Error: Must run from apps/tv directory${NC}"
    exit 1
fi

# Parse arguments
BUILD_TYPE="debug"
ENVIRONMENT="production"

while [[ $# -gt 0 ]]; do
    case $1 in
        --release)
            BUILD_TYPE="release"
            shift
            ;;
        --dev)
            ENVIRONMENT="development"
            shift
            ;;
        --clean)
            echo -e "${YELLOW}Cleaning build directories...${NC}"
            pnpm run clean:android
            rm -rf android/app/build
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./build-tv.sh [--release] [--dev] [--clean]"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}Building Android TV app...${NC}"
echo "Build type: $BUILD_TYPE"
echo "Environment: $ENVIRONMENT"

# Generate environment variables
echo -e "${YELLOW}Generating environment variables...${NC}"
APP_ENV=$ENVIRONMENT pnpm run generate-env

# Bundle JavaScript for release builds
if [ "$BUILD_TYPE" = "release" ]; then
    echo -e "${YELLOW}Bundling JavaScript...${NC}"
    pnpm run build
fi

# Build APK
echo -e "${YELLOW}Building APK...${NC}"
cd android

if [ "$BUILD_TYPE" = "release" ]; then
    ./gradlew assembleRelease
    APK_PATH="app/build/outputs/apk/release/app-release.apk"
else
    ./gradlew assembleDebug
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
fi

cd ..

# Check if build succeeded
if [ -f "android/$APK_PATH" ]; then
    echo -e "${GREEN}✅ Build successful!${NC}"
    echo -e "APK location: ${GREEN}android/$APK_PATH${NC}"
    
    # Get file size
    SIZE=$(ls -lh "android/$APK_PATH" | awk '{print $5}')
    echo -e "APK size: ${YELLOW}$SIZE${NC}"
    
    # Offer to install if device is connected
    if adb devices | grep -q "device$"; then
        echo ""
        read -p "Install on connected device? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Installing APK...${NC}"
            adb install -r "android/$APK_PATH"
            echo -e "${GREEN}✅ Installation complete!${NC}"
            
            # Launch the app
            echo -e "${YELLOW}Launching app...${NC}"
            adb shell monkey -p com.fitnessapptv -c android.intent.category.LAUNCHER 1
        fi
    fi
else
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi