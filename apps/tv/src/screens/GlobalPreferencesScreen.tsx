import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '../App';

export function GlobalPreferencesScreen({ route }: any) {
  const navigation = useNavigation();
  const { sessionId } = route.params;

  // TODO: Implement the full global preferences UI
  // For now, just a placeholder that navigates to workout overview

  return (
    <View className="flex-1 bg-gray-50 p-safe-x py-safe-y items-center justify-center">
      <Text className="text-tv-2xl font-bold text-gray-900 mb-8">
        Global Preferences
      </Text>
      <Text className="text-tv-lg text-gray-600 mb-8">
        Session: {sessionId}
      </Text>
      
      <TouchableOpacity
        onPress={() => navigation.navigate('WorkoutOverview', { sessionId })}
        className="px-12 py-6 bg-indigo-600 rounded-lg"
      >
        <Text className="text-tv-xl font-semibold text-white">
          Continue to Workout Overview
        </Text>
      </TouchableOpacity>
    </View>
  );
}