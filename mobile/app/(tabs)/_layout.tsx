import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { TabBarProvider, useTabBar } from '../../context/TabBarContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function CustomTabBar({ state, descriptors, navigation }: any) {
    const { colorScheme } = useColorScheme();
    const { tabBarTranslateY } = useTabBar();
    const insets = useSafeAreaInsets();

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{
                translateY: withTiming(tabBarTranslateY.value, {
                    duration: 250
                })
            }],
        };
    });

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute',
                    bottom: 20,
                    left: 20,
                    right: 20,
                    backgroundColor: colorScheme === 'dark' ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 25,
                    flexDirection: 'row',
                    paddingVertical: 12,
                    paddingBottom: 12, // Fixed padding, ignoring safe area for floating look
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 5 },
                    shadowOpacity: 0.3,
                    shadowRadius: 10,
                    elevation: 5,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                },
                animatedStyle
            ]}
        >
            {state.routes.map((route: any, index: number) => {
                const { options } = descriptors[route.key];
                const label =
                    options.tabBarLabel !== undefined
                        ? options.tabBarLabel
                        : options.title !== undefined
                            ? options.title
                            : route.name;

                const isFocused = state.index === index;

                const onPress = () => {
                    const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name, route.params);
                    }
                };

                const onLongPress = () => {
                    navigation.emit({
                        type: 'tabLongPress',
                        target: route.key,
                    });
                };

                // Icons Mapping
                let iconName: any = 'circle';
                if (route.name === 'home') iconName = isFocused ? 'home' : 'home-outline';
                else if (route.name === 'watchlist') iconName = isFocused ? 'trending-up' : 'trending-up-outline';
                else if (route.name === 'ask-ai') iconName = isFocused ? 'sparkles' : 'sparkles-outline';
                else if (route.name === 'profile') iconName = isFocused ? 'person' : 'person-outline';

                const activeColor = '#10B981'; // Primary Green
                const inactiveColor = colorScheme === 'dark' ? '#94A3B8' : '#64748B';

                return (
                    <TouchableOpacity
                        key={index}
                        accessibilityRole="button"
                        accessibilityState={isFocused ? { selected: true } : {}}
                        accessibilityLabel={options.tabBarAccessibilityLabel}
                        testID={options.tabBarTestID}
                        onPress={onPress}
                        onLongPress={onLongPress}
                        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Ionicons name={iconName} size={24} color={isFocused ? activeColor : inactiveColor} />
                        <Text style={{
                            color: isFocused ? activeColor : inactiveColor,
                            fontSize: 10,
                            fontWeight: isFocused ? '700' : '500',
                            marginTop: 2
                        }}>
                            {label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </Animated.View>
    );
}

export default function TabLayout() {
    const { colorScheme } = useColorScheme();

    return (
        <TabBarProvider>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <Tabs
                tabBar={props => <CustomTabBar {...props} />}
                screenOptions={{
                    headerShown: false,
                    tabBarHideOnKeyboard: true,
                }}
            >
                <Tabs.Screen name="home" options={{ title: 'Home' }} />
                <Tabs.Screen name="watchlist" options={{ title: 'Watchlist' }} />
                <Tabs.Screen name="ask-ai" options={{ title: 'Ask AI' }} />
                <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
            </Tabs>
        </TabBarProvider>
    );
}
