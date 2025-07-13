import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ChatNavigator from './ChatNavigator';
import HomeNavigator from './HomeNavigator';
import { MainTabsParamList } from './types';
import { Platform } from 'react-native';

const Tab = createBottomTabNavigator<MainTabsParamList>();

function getTabBarIcon({ route }: { route: any }) {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => {
    let iconName = 'home';
    
    if (route.name === 'Home') {
      iconName = focused ? 'home' : 'home';
    } else if (route.name === 'Chats') {
      iconName = focused ? 'chat' : 'chat-bubble-outline';
    } else if (route.name === 'Profile') {
      iconName = focused ? 'person' : 'person-outline';
    }
    
    return (
      <Icon 
        name={iconName} 
        size={focused ? size + 2 : size} 
        color={color}
        style={{
          marginTop: Platform.OS === 'ios' ? 2 : 0,
        }}
      />
    );
  };
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: getTabBarIcon({ route }),
        tabBarActiveTintColor: '#FF4B7B',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          paddingBottom: Platform.OS === 'ios' ? 0 : 5,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 25 : 8,
          height: Platform.OS === 'ios' ? 85 : 65,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 3.84,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeNavigator}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen 
        name="Chats" 
        component={ChatNavigator}
        options={{
          tabBarLabel: 'Chats',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}