import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function TestTailwindScreen() {
  console.log('TestTailwindScreen rendering');
  
  return (
    <View style={styles.mainContainer}>
      {/* Test 1: Regular React Native styles */}
      <View style={styles.container}>
        <Text style={styles.title}>Regular RN Styles Work ✓</Text>
      </View>
      
      {/* Test 2: Simple Tailwind test */}
      <View className="bg-blue-500 p-4 m-4">
        <Text className="text-white text-lg">
          If this has blue background, Tailwind works! 🎉
        </Text>
      </View>
      
      {/* Test 3: Inline style as fallback */}
      <View style={{ backgroundColor: 'green', padding: 16, margin: 16 }}>
        <Text style={{ color: 'white', fontSize: 18 }}>
          Green box with inline styles
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  container: {
    backgroundColor: 'red',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
});