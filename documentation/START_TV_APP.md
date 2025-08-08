# Fitness App - Complete Startup Guide

This guide explains how to run the full fitness app ecosystem including the web app, mobile app, and TV app.

## Prerequisites

1. **Android TV Emulator** - Must be created first (one-time setup)
   - Open Android Studio → Tools → AVD Manager
   - Create Virtual Device → TV category → Android TV (1080p)
   - Use API 33 or higher
   - Name it something memorable (e.g., "Android_TV_API_33")

2. **Environment Variables** - Ensure `.env` file is configured in the root directory

## Quick Start (All Apps)

From the project root directory:

```bash
# Terminal 1: Start all web services (Next.js + API)
pnpm dev

# Terminal 2: Start the TV app
cd apps/tv
npx react-native run-android --mode=tvDebug --deviceId emulator-5554
# If prompted about port 8081 being in use, select "Yes" to use 8082
# Note: --deviceId prevents React Native from launching a phone emulator

### Viewing TV App Logs
```bash
# In a new terminal, run:
npx react-native log-android
```

## Detailed Steps

### Step 1: Start the Web App (Required)
The web app serves as the backend API for all other apps.

```bash
# From project root
pnpm dev
```

Wait until you see:
- ✓ Ready at http://localhost:3000
- The web app must be running for the TV app to work

### Step 2: Start Android TV Emulator
```bash
# Option A: From Android Studio
# Tools → AVD Manager → Click play button next to your TV device

# Option B: From command line
emulator -avd Android_TV_API_33
```

Wait for the TV emulator to fully boot (shows Android TV home screen).

### Step 3: Start the TV App
```bash
# From project root
cd apps/tv
npx react-native run-android --mode=tvDebug --deviceId emulator-5554
```

The `--deviceId emulator-5554` flag ensures React Native uses your TV emulator instead of launching a phone emulator. The TV app should automatically install and launch on the TV emulator.

## How the Apps Work Together

1. **Web App (localhost:3000)**
   - Provides the tRPC API endpoints
   - Handles authentication
   - Manages the database
   - Trainers create training sessions here

2. **TV App**
   - Connects to the web app's API
   - Displays group workout sessions on a large screen
   - Users enter a 6-digit session code
   - Shows real-time workout updates

3. **Mobile App (Optional)**
   - Individual client app for personal tracking
   - Also connects to the web app's API

## Troubleshooting

### TV App won't connect to API
- Ensure the web app is running on port 3000
- Check that both apps are on the same network
- The TV app uses the computer's IP address to connect



### Metro bundler issues
```bash
# Clear metro cache
cd apps/tv
npx react-native start --reset-cache
```

### Build issues
```bash
# Clean and rebuild
cd apps/tv
pnpm run clean:android
cd android && ./gradlew clean
cd ..
npx react-native run-android --mode=tvDebug --deviceId emulator-5554
```

### Port conflicts
```bash
# Kill processes on common ports
lsof -ti:3000,8081 | xargs kill -9
```

## Development Workflow

1. Start web app first (it's the backend)
2. Make changes to TV app code
3. Metro bundler will hot reload changes
4. Use Android TV remote (arrow keys + enter) to navigate

## TV App Navigation

- **Arrow Keys**: Navigate between UI elements
- **Enter/Select**: Select items
- **Back**: Go back to previous screen
- **Menu**: Additional options (if implemented)

## Session Code Flow

1. Trainer creates a training session in the web app
2. System generates a 6-digit code
3. Participants enter this code on the TV app
4. TV displays the workout for all to see
5. Individual progress tracked on mobile devices