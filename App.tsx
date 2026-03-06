// App.tsx

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import Screens
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import LiveSafariScreen from './src/screens/LiveSafariScreen';
import TourPlannerScreen from './src/screens/TourPlannerScreen';
import DiaryScreen from './src/screens/DiaryScreen';
import SignupScreen from './src/screens/SignupScreen';
import ParkSelectionScreen from './src/screens/ParkSelectionScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// 1. Define types for our Tabs
// Added { parkId: string } so each tab knows which park data to load
export type MainTabParamList = {
  Home: { parkId: string };
  TourPlanner: { parkId: string };
  Diary: { parkId: string };
  Profile: { parkId: string };
};

// 2. Define types for our Main Stack
export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  ParkSelection: undefined;
  MainTabs: { parkId: string }; // <-- The Tabs now expect a parkId parameter
  LiveSafari: undefined; 
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Define props for MainTabs so it can read the route params passed from ParkSelection
type MainTabsProps = NativeStackScreenProps<RootStackParamList, 'MainTabs'>;

// 3. Create the Tab Navigator Component
function MainTabs({ route }: MainTabsProps) {
  // Call the hook here to get the device's safe area measurements
  const insets = useSafeAreaInsets(); 
  
  // Extract the parkId passed from the ParkSelectionScreen
  const { parkId } = route.params;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'TourPlanner') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Diary') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName as any} size={30} color={color} />;
        },
        tabBarActiveTintColor: '#00C853',
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: {
          fontSize: 15,
          fontWeight: '500',
        },
        tabBarStyle: {
          paddingVertical: 8,
          // Dynamically add the device's bottom inset to the height and padding
          height: 60 + insets.bottom, 
          paddingBottom: 10 + insets.bottom, 
        },
      })}
    >
      {/* Pass the parkId down to each screen using initialParams */}
      <Tab.Screen name="Home" component={HomeScreen} initialParams={{ parkId }} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="TourPlanner" component={TourPlannerScreen} initialParams={{ parkId }} options={{ tabBarLabel: 'Map' }} />
      <Tab.Screen name="Diary" component={DiaryScreen} initialParams={{ parkId }} options={{ tabBarLabel: 'Diary' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} initialParams={{ parkId }} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

// 4. Update the Root App component
export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
        {/* Auth Flow */}
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="ParkSelection" component={ParkSelectionScreen} />

        {/* Main App Experience */}
        <Stack.Screen name="MainTabs" component={MainTabs} />

        {/* Deep Screens (Hides Tab Bar) */}
        <Stack.Screen name="LiveSafari" component={LiveSafariScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}