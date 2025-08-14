import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '../App';

export function WorkoutOverviewScreen({ route }: any) {
  const navigation = useNavigation();
  const { sessionId } = route.params;

  // Hardcoded clients for UI demonstration
  const clients = [
    { userId: 'client1', userName: 'Client 1' },
    { userId: 'client2', userName: 'Client 2' },
    { userId: 'client3', userName: 'Client 3' },
    { userId: 'client4', userName: 'Client 4' },
  ];

  const getAvatarUrl = (userId: string) => {
    return `https://api.dicebear.com/7.x/avataaars/png?seed=${userId}&size=128`;
  };

  return (
    <View className="flex-1" style={{ 
      backgroundColor: '#0f1220',
      backgroundImage: 'radial-gradient(1200px 1000px at 10% -10%, rgba(94,225,169,.12), transparent 40%), radial-gradient(900px 600px at 110% 20%, rgba(43,196,138,.10), transparent 35%)'
    }}>
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
            borderRadius: 12,
            borderWidth: 1,
            borderColor: focused ? 'rgba(94,225,169,0.5)' : 'rgba(134,146,166,0.2)',
            backgroundColor: focused ? 'rgba(94,225,169,0.1)' : 'rgba(23,29,49,0.3)',
            transform: focused ? [{ scale: 1.05 }] : [{ scale: 1 }],
          })}
        >
          <Icon name="arrow-back" size={24} color="#E0E0E0" />
          <Text className="ml-2 text-lg" style={{ color: '#e0e0e0' }}>
            Back
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => navigation.navigate('WorkoutLive', { sessionId, round: 1 })}
          activeOpacity={0.7}
          tvParallaxProperties={{
            enabled: true,
            shiftDistanceX: 2,
            shiftDistanceY: 2,
          }}
          className="px-6 py-2.5 rounded-lg"
          style={{
            backgroundColor: 'rgba(94,225,169,0.9)',
            borderWidth: 1,
            borderColor: 'rgba(94,225,169,0.5)',
            shadowColor: '#5ee1a9',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text className="font-semibold" style={{ color: '#0f1220' }}>Start Workout</Text>
        </TouchableOpacity>
      </View>

      {/* Client Cards Grid */}
      <View className="flex-1 px-8 pb-12">
        <View className="flex-1 flex-row flex-wrap items-start content-start">
          {clients.map((client, index) => {
            const cardSizeClass = "w-1/2";
            const isCompact = false;
            
            return (
              <View key={client.userId} className={`${cardSizeClass} p-4`} style={{ height: '55%' }}>
                <View className="h-full flex" style={{
                  backgroundColor: 'transparent',
                  backgroundImage: 'linear-gradient(135deg, rgba(23,29,49,0.3), rgba(29,31,51,0.5))',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(134,146,166,0.15)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  elevation: 8,
                }}>
                  {/* Header Section */}
                  <View className="px-5 py-2.5 flex-row items-center">
                    <Image 
                      source={{ uri: getAvatarUrl(client.userId) }}
                      className="w-8 h-8 rounded-full mr-3"
                    />
                    <Text className="text-lg font-semibold" style={{ color: '#ffffff' }}>
                      {client.userName}
                    </Text>
                  </View>

                  {/* Content */}
                  <ScrollView 
                    className="flex-1"
                    contentContainerStyle={{ 
                      paddingHorizontal: 20,
                      paddingBottom: 12,
                      flexGrow: 1,
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text className="text-base" style={{ color: '#8692a6' }}>
                      Workout content goes here
                    </Text>
                  </ScrollView>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}