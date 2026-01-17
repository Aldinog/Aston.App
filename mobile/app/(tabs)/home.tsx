import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, RefreshControl, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedScrollHandler, useSharedValue, withTiming } from 'react-native-reanimated';
import { supabase } from '../../lib/supabase';
import { useTabBar } from '../../context/TabBarContext';
import PromoBanner from '../../components/PromoBanner';
import MarketPulse from '../../components/MarketPulse';
import AISignalCard from '../../components/AISignalCard';
import QuickMenu from '../../components/QuickMenu';
import TrendingList from '../../components/TrendingList';

export default function Home() {
    const { colorScheme } = useColorScheme();
    const [refreshing, setRefreshing] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [user, setUser] = useState<any>(null);
    const { tabBarTranslateY } = useTabBar();
    const lastContentOffset = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            const currentY = event.contentOffset.y;
            const diff = currentY - lastContentOffset.value;

            // Hide if scrolling down fast (> 0) and not at top (> 50px threshold)
            // Show if scrolling up (< -5)
            if (diff > 0 && currentY > 50) {
                tabBarTranslateY.value = 120; // Move down out of screen (increased slightly to be safe)
            } else if (diff < -5) {
                tabBarTranslateY.value = 0;
            }

            lastContentOffset.value = currentY;
        },
    });

    useEffect(() => {
        fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profile } = await supabase.from('users').select('*').eq('id', session.user.id).single();
                setUser(profile);
            }
        } catch (e) {
            console.log("Error fetching user:", e);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    const isPro = user?.membership_status === 'pro';

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchUserProfile(); // Refresh user data too
        setTimeout(() => {
            setRefreshKey(prev => prev + 1);
            setRefreshing(false);
            tabBarTranslateY.value = withTiming(0); // Reset tab bar visibility
        }, 1500);
    }, []);

    return (
        <SafeAreaView className={`flex-1 bg-background ${colorScheme}`} edges={['top']}>
            <Animated.ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 100 }}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colorScheme === 'dark' ? '#fff' : '#000'} />
                }
            >
                {/* 1. Header Section (Premium Redesign) */}
                <View className="px-6 pt-4 pb-2 flex-row justify-between items-center mb-4 mt-2">
                    {/* Left: Avatar & Greeting */}
                    <View className="flex-row items-center">
                        {/* Avatar with Status Aura */}
                        <View className="mr-5">
                            {isPro ? (
                                <LinearGradient
                                    colors={['#F59E0B', '#FBBF24', '#78350f']}
                                    className="p-[2px] rounded-full"
                                >
                                    <View className="bg-background rounded-full p-[2px]">
                                        <Image
                                            source={{ uri: user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email || 'User'}&background=0f172a&color=fff` }}
                                            className="w-12 h-12 rounded-full"
                                        />
                                    </View>
                                </LinearGradient>
                            ) : (
                                <View className="p-[2px] rounded-full border border-slate-700">
                                    <Image
                                        source={{ uri: user?.avatar_url || `https://ui-avatars.com/api/?name=${user?.email || 'User'}&background=1e293b&color=94a3b8` }}
                                        className="w-12 h-12 rounded-full"
                                    />
                                </View>
                            )}
                            {/* Pro Badge (Absolute) */}
                            {isPro && (
                                <View className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1 border border-black">
                                    <Ionicons name="star" size={10} color="black" />
                                </View>
                            )}
                        </View>

                        {/* Greeting Text */}
                        <View>
                            <Text className="text-muted-foreground text-xs font-medium">{getGreeting()},</Text>
                            <Text className="text-foreground font-black text-xl tracking-tight capitalize">
                                {user?.full_name?.split(' ')[0] || 'Trader'}
                            </Text>
                            <View className="flex-row items-center mt-0.5">
                                <Ionicons name="calendar-outline" size={10} color="#64748b" style={{ marginRight: 4 }} />
                                <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{todayDate}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Right: Notification */}
                    <TouchableOpacity className="w-10 h-10 bg-slate-800/50 border border-white/5 rounded-full justify-center items-center relative">
                        <Ionicons name="notifications-outline" size={20} color={colorScheme === 'dark' ? '#cbd5e1' : '#334155'} />
                        <View className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-slate-900" />
                    </TouchableOpacity>
                </View>

                {/* 2. Promo Banner (Automated) */}
                <PromoBanner />

                {/* 3. Market Pulse */}
                <View className="px-6 mt-2 mb-4">
                    <Text className="text-foreground text-lg font-bold mb-3">Market Pulse</Text>
                    <MarketPulse key={`pulse-${refreshKey}`} />
                </View>

                {/* 4. AI Signal Card */}
                <AISignalCard key={`signal-${refreshKey}`} />

                {/* 5. Quick Actions */}
                <QuickMenu />

                {/* 6. Trending List */}
                <View className="mt-2">
                    <View className="px-6 mb-3 flex-row justify-between items-center">
                        <Text className="text-foreground text-lg font-bold">Trending Now 🔥</Text>
                        <Text className="text-primary text-xs font-bold">View All</Text>
                    </View>
                    <TrendingList key={`trend-${refreshKey}`} />
                </View>
            </Animated.ScrollView>
        </SafeAreaView>
    );
}
