import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function TabLayout() {
    const { colorScheme } = useColorScheme();

    return (
        <>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <Tabs
                screenOptions={{
                    tabBarActiveTintColor: '#10B981', // Primary Green
                    tabBarInactiveTintColor: colorScheme === 'dark' ? '#64748B' : '#94A3B8',
                    tabBarShowLabel: true, // User requested text below icon
                    tabBarLabelStyle: {
                        fontSize: 10,
                        fontWeight: '600',
                        marginBottom: 5,
                    },
                    tabBarStyle: {
                        position: 'absolute',
                        bottom: 20,
                        left: 16,
                        right: 16,
                        elevation: 0,
                        backgroundColor: colorScheme === 'dark' ? '#1E293B' : '#FFFFFF',
                        borderRadius: 20,
                        height: 70, // Sufficient height for Icon + Text
                        borderTopWidth: 0,
                        shadowColor: '#000',
                        shadowOffset: {
                            width: 0,
                            height: 4,
                        },
                        shadowOpacity: 0.15,
                        shadowRadius: 10,
                        paddingBottom: 5,
                        paddingTop: 5,
                    },
                    headerShown: false,
                }}
            >
                <Tabs.Screen
                    name="home"
                    options={{
                        title: 'Home',
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="watchlist"
                    options={{
                        title: 'Watchlist',
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons name={focused ? "trending-up" : "trending-up-outline"} size={24} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="ask-ai"
                    options={{
                        title: 'Ask AI',
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={24} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="profile"
                    options={{
                        title: 'Profile',
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
                        ),
                    }}
                />
            </Tabs>
        </>
    );
}
