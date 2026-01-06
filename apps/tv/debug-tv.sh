#!/bin/bash

# Debug script for Android TV logging

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}Android TV Debug Helper${NC}"
echo "========================"

# Check if device is connected
if ! adb devices | grep -q "device$"; then
    echo -e "${RED}No Android device connected!${NC}"
    echo "Make sure your Android TV is connected via ADB"
    exit 1
fi

# Get device info
DEVICE=$(adb devices | grep device$ | awk '{print $1}')
echo -e "${BLUE}Connected to device: ${DEVICE}${NC}"

# Function to show menu
show_menu() {
    echo ""
    echo "Select an option:"
    echo "1) View all React Native logs"
    echo "2) View lighting-specific logs"
    echo "3) View network/API logs"
    echo "4) View all app logs (verbose)"
    echo "5) Clear logcat and start fresh"
    echo "6) Save logs to file"
    echo "7) View JavaScript errors only"
    echo "8) Exit"
}

# Main loop
while true; do
    show_menu
    read -p "Enter choice [1-8]: " choice
    
    case $choice in
        1)
            echo -e "${YELLOW}Showing React Native logs...${NC}"
            echo "Press Ctrl+C to stop"
            adb logcat *:S ReactNative:V ReactNativeJS:V
            ;;
        2)
            echo -e "${YELLOW}Showing lighting-specific logs...${NC}"
            echo "Press Ctrl+C to stop"
            adb logcat | grep -E "Lighting|lighting|HUE|Hue|Scene|scene"
            ;;
        3)
            echo -e "${YELLOW}Showing network/API logs...${NC}"
            echo "Press Ctrl+C to stop"
            adb logcat | grep -E "API|api|fetch|XMLHttpRequest|Network|TRPC|trpc"
            ;;
        4)
            echo -e "${YELLOW}Showing all app logs...${NC}"
            echo "Press Ctrl+C to stop"
            adb logcat | grep -E "com.fitnessapptv|ReactNative|ReactNativeJS"
            ;;
        5)
            echo -e "${YELLOW}Clearing logcat...${NC}"
            adb logcat -c
            echo -e "${GREEN}Logcat cleared!${NC}"
            ;;
        6)
            TIMESTAMP=$(date +%Y%m%d_%H%M%S)
            FILENAME="tv_logs_${TIMESTAMP}.txt"
            echo -e "${YELLOW}Saving logs to ${FILENAME}...${NC}"
            adb logcat -d > "$FILENAME"
            echo -e "${GREEN}Logs saved to ${FILENAME}${NC}"
            ;;
        7)
            echo -e "${YELLOW}Showing JavaScript errors only...${NC}"
            echo "Press Ctrl+C to stop"
            adb logcat *:E | grep -E "ReactNative|ReactNativeJS|JS"
            ;;
        8)
            echo -e "${GREEN}Exiting...${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice!${NC}"
            ;;
    esac
done