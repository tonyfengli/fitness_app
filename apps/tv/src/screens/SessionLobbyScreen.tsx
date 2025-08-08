import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '../App';

export function SessionLobbyScreen() {
  const navigation = useNavigation();

  const handleStartSession = () => {
    // Navigate with a demo session ID
    navigation.navigate('GlobalPreferences', { sessionId: 'demo-session-123' });
  };

  return (
    <View className="flex-1 bg-gray-900 p-12">
      <View className="flex-1 items-center justify-center">
        <Text className="text-tv-5xl font-bold text-white mb-4">
          Fitness Session
        </Text>
        
        <Text className="text-tv-2xl text-gray-300 mb-12">
          Welcome to today's workout
        </Text>

        <TouchableOpacity
          onPress={handleStartSession}
          className="bg-indigo-600 px-16 py-8 rounded-2xl"
        >
          <Text className="text-tv-2xl font-semibold text-white">
            Start Session
          </Text>
        </TouchableOpacity>

        <View className="mt-16">
          <Text className="text-tv-lg text-gray-400">
            Press Enter or click to begin
          </Text>
        </View>
      </View>
    </View>
  );
}