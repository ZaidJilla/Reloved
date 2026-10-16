import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

import HomeScreen from '../screens/HomeScreen';
import ListingDetailScreen from '../screens/ListingDetailScreen';
import CreateListingScreen from '../screens/CreateListingScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { categoryFor, colors, space, stackHeaderOptions } from '../theme';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const MessagesStack = createNativeStackNavigator();

function listingDetailOptions({ route }) {
  const { color } = categoryFor(route.params?.category);
  return {
    title: '',
    // The card-expand overlay handles the motion, so no native push/pop
    // animation or swipe-back (which would skip the reverse transition).
    animation: 'none',
    gestureEnabled: false,
    headerStyle: { backgroundColor: color },
    contentStyle: { backgroundColor: color },
  };
}

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={stackHeaderOptions}>
      <HomeStack.Screen name="Browse" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="ListingDetail" component={ListingDetailScreen} options={listingDetailOptions} />
    </HomeStack.Navigator>
  );
}

function MessagesStackScreen() {
  return (
    <MessagesStack.Navigator screenOptions={stackHeaderOptions}>
      <MessagesStack.Screen name="MessagesList" component={MessagesScreen} options={{ headerShown: false }} />
      <MessagesStack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
    </MessagesStack.Navigator>
  );
}

// Listing uses its own bar, so hide the floating nav while it's showing.
const hideBarOnListing = (title) => ({ route }) => ({
  title,
  tabBarStyle: getFocusedRouteNameFromRoute(route) === 'ListingDetail' ? { display: 'none' } : styles.bar,
});

const ICONS = {
  HomeTab: ['home', 'home-outline'],
  MessagesTab: ['chatbubble', 'chatbubble-outline'],
  ProfileTab: ['person', 'person-outline'],
};

// Floating black pill: 64 tall, inset 16 from the sides. The center Sell tab is a
// 48 white circle with a plus. Screens add bottom padding so content clears it.
export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.bar,
        tabBarItemStyle: styles.item,
        sceneStyle: { backgroundColor: colors.cream },
        tabBarIcon: ({ focused, color }) =>
          route.name === 'SellTab' ? (
            <View style={styles.plus}>
              <Ionicons name="add" size={28} color={colors.ink} />
            </View>
          ) : (
            <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={24} color={color} />
          ),
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackScreen} options={hideBarOnListing('Browse')} />
      <Tab.Screen name="MessagesTab" component={MessagesStackScreen} options={{ title: 'Messages' }} />
      <Tab.Screen name="SellTab" component={CreateListingScreen} options={{ title: 'Sell' }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.lg,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.ink,
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    paddingBottom: 0,
  },
  item: { height: 64, justifyContent: 'center' },
  plus: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
