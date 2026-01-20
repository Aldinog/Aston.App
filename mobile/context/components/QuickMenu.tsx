import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useRouter } from 'expo-router';

const MENU_ITEMS = [
    { title: 'Chart Pro', icon: 'chart-line', color: '#10b981', route: '/chart-pro' }, // Green
    { title: 'Screener', icon: 'filter-outline', color: '#3b82f6', route: '/screener' }, // Blue
    { title: 'Calculator', icon: 'calculator-variant', color: '#a855f7', route: '/calculator' }, // Purple
    { title: 'Learn', icon: 'school-outline', color: '#f59e0b', route: '/learn' }, // Amber
    { title: 'Upgrade', icon: 'crown-outline', color: '#8b5cf6', route: '/pro' }, // Violet
];

export default function QuickMenu() {
    const { colorScheme } = useColorScheme();
    const router = useRouter();

    return (
        <View className="px-6 mb-8">
            <Text className="text-foreground text-lg font-bold mb-4">Quick Actions</Text>
            <View className="flex-row justify-between flex-wrap">
                {MENU_ITEMS.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        activeOpacity={0.7}
                        className="items-center w-[19%]"
                        onPress={() => router.push(item.route as any)}
                    >
                        <View
                            className="w-14 h-14 rounded-2xl justify-center items-center mb-2 shadow-sm bg-card border border-border"
                        >
                            <MaterialCommunityIcons
                                name={item.icon as any}
                                size={28}
                                color={item.color}
                            />
                        </View>
                        <Text className="text-foreground text-xs font-medium text-center" numberOfLines={1}>
                            {item.title}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}
