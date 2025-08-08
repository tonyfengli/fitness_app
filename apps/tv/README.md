# Fitness App TV

React Native TV app for displaying workouts on Android TV / Google TV devices.

## Setup Instructions

### 1. Install Android Studio

1. Download Android Studio from https://developer.android.com/studio
2. During installation, ensure you install:
   - Android SDK
   - Android SDK Platform-Tools
   - Android Virtual Device

### 2. Set up Android TV Emulator

1. Open Android Studio
2. Click "More Actions" → "Virtual Device Manager" (or Tools → AVD Manager)
3. Click "Create Virtual Device"
4. Select "TV" category
5. Choose "Android TV (4K)" or "Android TV (1080p)"
6. Select system image (API 31 or higher for Google TV)
7. Click "Next" and "Finish"

### 3. Configure Environment

Add to your shell profile (`~/.zshrc` or `~/.bash_profile`):

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

Then reload your shell:
```bash
source ~/.zshrc  # or source ~/.bash_profile
```

### 4. Install Dependencies

From the monorepo root:
```bash
pnpm install
```

### 5. Set up Android Project

From the TV app directory:
```bash
cd apps/tv
./setup-android.sh
```

### 6. Configure API URL

Update `src/providers/TRPCProvider.tsx` with your API URL:
```typescript
const debuggerHost = 'YOUR_NGROK_URL'; // or production URL
```

### 7. Run the App

Start the Android TV emulator, then:

```bash
# From apps/tv directory
npm run android:tv

# Or from monorepo root
pnpm --filter @acme/tv android:tv
```

## Development

### TV Navigation

The app uses D-pad navigation. Key mappings:
- **Arrow keys**: Navigate between focusable elements
- **Enter/Select**: Press buttons
- **Back/Menu**: Go back to previous screen

### Screens

1. **Session Lobby**: Enter 6-digit session code
2. **Global Preferences**: Set workout preferences for all clients
3. **Workout Overview**: View all clients and exercises
4. **Workout Live**: Display current round with timer

### Customization

TV-specific styles are in `tailwind.config.ts`:
- `tv-*` font sizes for 10-foot viewing
- `safe-x` and `safe-y` for TV-safe margins

## Troubleshooting

### "SDK location not found"
Create `android/local.properties`:
```
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
```

### Metro bundler issues
Clear cache:
```bash
npx react-native start --reset-cache
```

### Build errors
Clean and rebuild:
```bash
cd android
./gradlew clean
cd ..
npm run android:tv
```