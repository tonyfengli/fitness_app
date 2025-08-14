import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '../App';

export function WorkoutLiveScreen() {
  const navigation = useNavigation();
  const sessionId = navigation.getParam('sessionId');
  const round = navigation.getParam('round') || 1;

  return (
    <View className="flex-1" style={{ backgroundColor: '#121212' }}>
      {/* Header */}
      <View className="px-8 py-6 flex-row justify-between items-center">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          tvParallaxProperties={{
            enabled: true,
            shiftDistanceX: 2,
            shiftDistanceY: 2,
          }}
          style={({ focused }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: focused ? '#3b82f6' : 'transparent',
            backgroundColor: focused ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            transform: focused ? [{ scale: 1.05 }] : [{ scale: 1 }],
          })}
        >
          <Icon name="arrow-back" size={24} color="#E0E0E0" />
          <Text className="ml-2 text-lg text-gray-200">
            Back
          </Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-6">
          <Text className="text-2xl font-bold text-white">
            Round {round}
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            tvParallaxProperties={{
              enabled: true,
              shiftDistanceX: 2,
              shiftDistanceY: 2,
            }}
            className="px-6 py-2.5 bg-red-600 rounded-lg"
            onPress={() => navigation.navigate('SessionLobby', { sessionId })}
          >
            <Text className="text-white font-semibold">End Workout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View className="flex-1 items-center justify-center px-8">
        <Icon name="fitness-center" size={80} color="#4B5563" />
        <Text className="text-3xl font-bold text-white mt-6">
          Workout Live
        </Text>
        <Text className="text-lg text-gray-400 mt-2 text-center">
          This is where the live workout interface will be displayed
        </Text>
        <Text className="text-sm text-gray-500 mt-4">
          Session ID: {sessionId}
        </Text>
      </View>

      {/* Bottom Status Bar */}
      <View className="px-8 py-4 bg-gray-900">
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center">
              <Icon name="timer" size={20} color="#9CA3AF" />
              <Text className="text-gray-400 ml-2">0:00</Text>
            </View>
            <View className="flex-row items-center">
              <Icon name="group" size={20} color="#9CA3AF" />
              <Text className="text-gray-400 ml-2">0 Active</Text>
            </View>
          </View>
          <Text className="text-gray-500 text-sm">
            Waiting to start...
          </Text>
        </View>
      </View>
    </View>
  );
}