# Android TV Deployment Guide

## Method 1: ADB over Network (Recommended)

### Setup Android TV for Debugging:
1. **Enable Developer Mode**
   - Settings → Device Preferences → About
   - Click on "Build" 7 times
   
2. **Enable ADB Debugging**
   - Settings → Device Preferences → Developer options
   - Turn on "USB debugging"
   - Turn on "ADB debugging" (if available)

3. **Find TV's IP Address**
   - Settings → Network & Internet → (Your Network)
   - Note the IP address (e.g., 192.168.1.100)

### Connect and Install:
```bash
# Connect to TV
adb connect YOUR_TV_IP:5555

# Verify connection
adb devices

# Install APK
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Launch app
adb shell monkey -p com.fitnessapptv -c android.intent.category.LAUNCHER 1

# View logs
adb logcat | grep ReactNativeJS
```

## Method 2: USB Drive

1. Copy APK to USB drive
2. Install file manager on TV:
   - FX File Explorer (recommended)
   - X-plore File Manager
   - Total Commander
3. Enable "Unknown sources" in TV settings
4. Navigate to USB and install APK

## Method 3: Cloud Storage

1. Upload APK to Google Drive/Dropbox
2. Install cloud app on TV
3. Download and install APK

## Method 4: Send Files to TV App

1. Install "Send files to TV" on both phone and TV
2. Connect to same WiFi network
3. Send APK from phone to TV
4. Install on TV

## Troubleshooting

### "App not installed" error:
- Enable "Unknown sources" in Security settings
- Uninstall previous version: `adb uninstall com.fitnessapptv`
- Check minimum API level compatibility

### Connection issues:
```bash
# Reset ADB
adb kill-server
adb start-server

# If TV doesn't appear:
adb tcpip 5555
adb connect YOUR_TV_IP:5555
```

### Performance issues:
- Enable hardware acceleration in AndroidManifest.xml
- Use release build instead of debug
- Check TV specifications (RAM, CPU)

## Remote Control Navigation

Ensure your app supports D-pad navigation:
- Arrow keys for navigation
- Enter/OK for selection
- Back button for going back

Test with ADB:
```bash
# Simulate remote control
adb shell input keyevent KEYCODE_DPAD_UP
adb shell input keyevent KEYCODE_DPAD_DOWN
adb shell input keyevent KEYCODE_DPAD_LEFT
adb shell input keyevent KEYCODE_DPAD_RIGHT
adb shell input keyevent KEYCODE_DPAD_CENTER
adb shell input keyevent KEYCODE_BACK
```