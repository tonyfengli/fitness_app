#!/bin/bash

# Initialize React Native Android project
echo "Setting up Android TV project..."

# Create Android directory structure
mkdir -p android/app/src/main/java/com/fitnessapptv
mkdir -p android/app/src/main/res/values

# We'll use React Native CLI to generate the Android files
npx react-native init FitnessAppTV --directory temp_init --skip-install

# Copy Android files from temp project
if [ -d "temp_init/android" ]; then
  cp -r temp_init/android/* android/
  rm -rf temp_init
fi

echo "Android project structure created!"
echo ""
echo "Next steps:"
echo "1. Open Android Studio"
echo "2. Open the 'android' folder in this project"
echo "3. Let it sync and download dependencies"
echo "4. Create an Android TV emulator if you haven't already"
echo "5. Run: npm run android:tv"