# Building Release APK for Android TV

## 1. Generate Release Keystore

```bash
cd apps/tv/android/app
keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for:
- Keystore password (remember this!)
- Key password (can be same as keystore password)
- Your name, organization, etc.

## 2. Configure Signing in Gradle

Edit `android/gradle.properties` and add:
```
MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=my-key-alias
MYAPP_RELEASE_STORE_PASSWORD=your-keystore-password
MYAPP_RELEASE_KEY_PASSWORD=your-key-password
```

## 3. Update build.gradle

Edit `android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled enableProguardInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
```

## 4. Build Release APK

```bash
cd apps/tv

# Set production environment
APP_ENV=production pnpm run generate-env

# Bundle JavaScript
pnpm run build

# Build release APK
cd android
./gradlew assembleRelease

# APK location: android/app/build/outputs/apk/release/app-release.apk
```

## 5. Install on Android TV

### Via USB Debugging:
```bash
# Enable Developer Mode on Android TV:
# Settings > Device Preferences > About > Click "Build" 7 times

# Enable USB Debugging:
# Settings > Device Preferences > Developer options > USB debugging

# Connect and install
adb connect YOUR_TV_IP:5555
adb install android/app/build/outputs/apk/release/app-release.apk
```

### Via USB Drive:
1. Copy APK to USB drive
2. Install a file manager on Android TV (e.g., X-plore, FX File Explorer)
3. Navigate to USB drive and install APK

### Via Network (easier):
1. Use "Send files to TV" app on both phone and TV
2. Or use cloud storage (Google Drive, Dropbox)

## Important Notes

- **Keep your keystore safe!** You need it for all future updates
- **Never commit keystore files or passwords to git**
- Add to `.gitignore`:
  ```
  *.keystore
  android/gradle.properties
  ```