import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatDetailScreen from '../screens/Chat/ChatDetailScreen';
import HomeScreen from '../screens/Home/HomeScreen';
type HomeStackParamList = {
    Home: undefined;
    ChatDetail: { chatName?: string };
  };
  
const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }}/>
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} options={({ route }) => ({ title: route.params?.chatName ?? 'Chat Detail' })}/>
    </Stack.Navigator>
  );
}
